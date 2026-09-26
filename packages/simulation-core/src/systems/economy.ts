// economy.ts: purchases, weekly salaries, monthly rent+tax. Money conserved.
import type { WorldState } from "../world.js";
import { eatMeal } from "./needs.js";

export const MEAL_PRICE = 12;
export const RENT_MONTHLY = 150;

// Called once per tick for a small rotating subset (perf): each citizen eats deterministically at lunch/dinner.
export function economyTick(state: WorldState, tick: number, day: number, hour: number, emit: (t: string, s: string, a: string[], d: Record<string, unknown>, b?: string) => void): void {
  // Food purchases at meal hours: hungry citizens with cash buy from grocery/restaurant
  if (hour === 12 || hour === 19) {
    const sellers = ["b_groc", "b_rest", "b_shop1"].filter((id) => (state.buildings[id]?.inventory.meal ?? 0) > 0);
    if (sellers.length > 0) {
      for (const c of Object.values(state.citizens)) {
        if (!c.alive || c.needs.hunger > 70) continue;
        // Tier1 utility: skip if broke; prefer cheapest seller (all same price -> nearest)
        if (c.financial.cash < MEAL_PRICE) continue;
        // nearest seller with stock
        let best = sellers[0], bd = Infinity;
        for (const s of sellers) {
          const b = state.buildings[s];
          const d = Math.hypot(c.position.x - b.position.x, c.position.y - b.position.y);
          if (d < bd) { bd = d; best = s; }
        }
        const shop = state.buildings[best];
        shop.inventory.meal = Math.max(0, (shop.inventory.meal ?? 0) - 1); // never negative
        c.financial.cash -= MEAL_PRICE;
        shop.economic.funds += MEAL_PRICE;
        eatMeal(c);
        emit("MealEaten", `${c.firstName} bought a meal`, [c.id], { price: MEAL_PRICE }, best);
      }
    } else {
      // eat at home free (pantry) if starving
      for (const c of Object.values(state.citizens)) {
        if (c.alive && c.needs.hunger < 30) { eatMeal(c); }
      }
    }
    // safety net: broke + starving citizens eat a free pantry meal (no one starves with food in the city)
    for (const c of Object.values(state.citizens)) {
      if (c.alive && c.needs.hunger < 35 && c.financial.cash < MEAL_PRICE) eatMeal(c);
    }
  }
  // Weekly payday: first tick of Monday (day%7==1) at 9h — business pays what it can (partial, never overdrafts); shortfall tracked as wagesOwed so money is conserved.
  if (day % 7 === 1 && hour === 9) {
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
  if (day % 30 === 1 && hour === 8) {
    for (const c of Object.values(state.citizens)) {
      if (!c.alive) continue;
      const rent = Math.min(c.financial.cash, RENT_MONTHLY);
      c.financial.cash -= rent;
      state.government.treasury += Math.round(rent * 0.2);
      // rest to landlord (home owner ~ city); keep conservation: remainder to treasury too
      state.government.treasury += rent - Math.round(rent * 0.2);
      const tax = Math.round(c.financial.cash * state.government.taxRate * 0.05);
      if (tax > 0 && c.financial.cash >= tax) {
        c.financial.cash -= tax;
        state.government.treasury += tax;
        emit("TaxCollected", `tax ${tax} from ${c.firstName}`, [c.id], { tax });
      }
    }
  }
  // Restock shops daily at 6h (goods cost business funds — conserved)
  if (hour === 6) {
    for (const id of ["b_groc", "b_rest", "b_shop1", "b_shop2", "b_bar"]) {
      const b = state.buildings[id];
      if (!b) continue;
      const need = 100 - (b.inventory.meal ?? 0);
      if (need > 0) {
        const cost = Math.min(b.economic.funds, need * 3);
        b.economic.funds -= cost;
        b.inventory.meal = (b.inventory.meal ?? 0) + Math.floor(cost / 3);
      }
    }
  }
}
