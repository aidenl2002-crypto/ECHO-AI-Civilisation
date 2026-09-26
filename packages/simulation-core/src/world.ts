// WorldState + world generation (deterministic from seed).
import { Building, Citizen, EchoPost, Goal, Job, MemoryEntry, Relationship, SimEvent, relKey, clamp01 } from "@echo/shared";
import { Rng } from "./rng.js";

export interface Government { mayorId: string | null; taxRate: number; treasury: number; }
export interface WorldMetrics { day: number; population: number; totalWealth: number; businesses: number; avgHappiness: number; avgHealth: number; employmentRate: number; moneySupply: number; }
export interface WorldState {
  seed: number; cityName: string;
  citizens: Record<string, Citizen>;
  buildings: Record<string, Building>;
  jobs: Record<string, Job>;
  relationships: Record<string, Relationship>;
  memories: MemoryEntry[];
  events: SimEvent[];
  posts: EchoPost[];
  goals: Record<string, Goal>;
  government: Government;
  moneySupply: number;
  metricsHistory: WorldMetrics[];
  eventSeq: number;
}

const FIRST_M = ["James","John","Robert","Michael","David","Tomas","Petr","Lukas","Martin","Omar","Kenji","Carlos","Ivan","Wei","Samuel","George","Aiden","Marcus","Leo","Finn"];
const FIRST_F = ["Mary","Anna","Eva","Sofia","Mia","Lena","Aisha","Yuki","Maria","Elena","Petra","Lucie","Nina","Clara","Iris","Noor","Hana","Zoe","Ruby","Ada"];
const LAST = ["Novak","Smith","Garcia","Kim","Muller","Rossi","Khan","Silva","Chen","Haddad","Novakova","Brown","Dube","Tanaka","Ivanov","Silva","Moreau","Kaur","Larsen","Vega"];

function traits(rng: Rng): Citizen["psychology"] {
  const r = () => clamp01(rng.next());
  return { openness: r(), conscientiousness: r(), extraversion: r(), agreeableness: r(), neuroticism: r(), ambition: r(), empathy: r(), greed: r(), honesty: r(), loyalty: r(), riskTaking: r(), patience: r(), curiosity: r(), discipline: r(), sociability: r(), aggression: r(), optimism: r(), religiosity: r() };
}
function skills(rng: Rng): Citizen["skills"] {
  const r = () => Math.round(rng.next() * 60);
  return { farming: r(), cooking: r(), medicine: r(), engineering: r(), trading: r(), leadership: r(), combat: r(), teaching: r(), crafting: r(), mining: r(), fishing: r(), building: r(), music: r(), science: r() };
}

export function createWorld(seed: number, cityName: string, citizenCount = 40): WorldState {
  const rng = new Rng(seed);
  const citizens: Record<string, Citizen> = {};
  const buildings: Record<string, Building> = {};
  const jobs: Record<string, Job> = {};
  const relationships: Record<string, Relationship> = {};

  // --- buildings ---
  const mk = (id: string, name: string, type: Building["type"], cap: number, inv: Record<string, number> = {}, funds = 5000): Building => ({
    id, name, type, position: { x: Math.round(rng.range(50, 950)), y: Math.round(rng.range(50, 950)) },
    capacity: cap, ownerId: null, workers: [], inventory: { ...inv }, openingHours: { open: 6, close: 22 }, economic: { funds, priceLevel: 1, wagesOwed: 0 },
  });
  const fixed: Array<[string, string, Building["type"], number, Record<string, number>]> = [
    ["b_townhall", "Town Hall", "town_hall", 50, {}],
    ["b_police", "Police Station", "police", 10, {}],
    ["b_clinic", "Clinic", "clinic", 15, { medicine: 40 }],
    ["b_bar", "Neon Bar", "bar", 30, { meal: 60, drink: 100 }],
    ["b_rest", "Grand Restaurant", "restaurant", 30, { meal: 80 }],
    ["b_groc", "Grocery", "grocery", 25, { meal: 150, groceries: 200 }],
    ["b_fact", "Factory", "factory", 20, { goods: 100 }],
    ["b_bank", "City Bank", "bank", 20, {}],
    ["b_school", "School", "school", 40, {}],
    ["b_park", "Central Park", "park", 200, {}],
    ["b_shop1", "General Shop", "shop", 15, { goods: 80, meal: 30 }],
    ["b_shop2", "Market Stall", "shop", 12, { goods: 60, groceries: 60 }],
  ];
  for (const [id, name, type, cap, inv] of fixed) buildings[id] = mk(id, name, type, cap, inv);
  for (let i = 0; i < 8; i++) buildings[`b_home${i}`] = mk(`b_home${i}`, `Home ${i + 1}`, "home", 6, {}, 0);

  // --- citizens ---
  const ids: string[] = [];
  for (let i = 0; i < citizenCount; i++) {
    const sex = rng.next() < 0.5 ? "M" as const : "F" as const;
    const fn = sex === "M" ? rng.pick(FIRST_M) : rng.pick(FIRST_F);
    const id = `c_${i.toString().padStart(3, "0")}`;
    const age = rng.int(18, 70);
    const homeIdx = i % 8;
    const cash = Math.round(rng.range(500, 5000));
    const bank = Math.round(rng.range(0, 3000));
    citizens[id] = {
      id, firstName: fn, lastName: rng.pick(LAST), sex, age, alive: true,
      position: { ...buildings[`b_home${homeIdx}`].position },
      homeId: `b_home${homeIdx}`, workBuildingId: null, jobId: null, destinationBuildingId: null,
      currentActivity: "idle",
      physical: { height: Math.round(rng.range(155, 195)), health: Math.round(rng.range(60, 100)) },
      psychology: traits(rng), skills: skills(rng),
      emotions: { joy: 0.5, sadness: 0.1, anger: 0.05, fear: 0.05, love: 0.3, stress: 0.2 },
      needs: { hunger: Math.round(rng.range(50, 90)), energy: Math.round(rng.range(50, 100)), health: Math.round(rng.range(60, 100)), happiness: Math.round(rng.range(40, 80)) },
      financial: { cash, bank, debt: 0 },
      marriedToId: null, goalIds: [], tickBorn: 0, tickDied: null,
    };
    ids.push(id);
  }

  // --- businesses + jobs (8) ---
  const bizB = ["b_bar", "b_rest", "b_groc", "b_fact", "b_shop1", "b_shop2", "b_clinic", "b_bank"];
  const titles: Array<[string, keyof Citizen["skills"] | null, number]> = [
    ["Bartender", "sociability" as unknown as keyof Citizen["skills"], 140], ["Chef", "cooking", 165],
    ["Grocer", "trading", 130], ["Factory Worker", "engineering", 150], ["Shopkeeper", "trading", 135],
    ["Vendor", "trading", 120], ["Nurse", "medicine", 190], ["Clerk", "trading", 155],
  ];
  bizB.forEach((b, i) => {
    const [title, skill, salary] = titles[i];
    const jid = `j_${i}`;
    jobs[jid] = { id: jid, title, buildingId: b, salary, workerId: null, skillRequired: skill };
  });

  // assign ~70% employment
  const shuffled = [...ids].sort(() => rng.next() - 0.5);
  const jobIds = Object.keys(jobs);
  // allow multiple workers per building: create extra job slots
  let ji = 0;
  const employedTarget = Math.floor(ids.length * 0.7);
  for (let k = 0; k < employedTarget; k++) {
    const cid = shuffled[k];
    let job = jobs[jobIds[ji % jobIds.length]];
    if (job.workerId) {
      // clone slot
      const nid = `j_extra_${k}`;
      jobs[nid] = { ...job, id: nid, workerId: null };
      job = jobs[nid];
    }
    job.workerId = cid;
    citizens[cid].jobId = job.id;
    citizens[cid].workBuildingId = job.buildingId;
    buildings[job.buildingId].workers.push(cid);
    ji++;
  }
  // business owners: first worker's building owner
  for (const b of bizB) {
    if (buildings[b].workers.length > 0) buildings[b].ownerId = buildings[b].workers[0];
  }

  // --- sparse initial relationships (acquaintances) ---
  for (let k = 0; k < citizenCount * 2; k++) {
    const a = rng.pick(ids), b = rng.pick(ids);
    if (a === b) continue;
    const key = relKey(a, b);
    if (relationships[key]) continue;
    relationships[key] = {
      aId: a, bId: b, familiarity: rng.range(0.1, 0.5), trust: rng.range(0.2, 0.6),
      affection: rng.range(0, 0.4), attraction: rng.range(0, 0.4), respect: rng.range(0.2, 0.5),
      resentment: 0, fear: 0, dependency: 0, loyalty: rng.range(0, 0.3),
      type: "acquaintance", interactions: 1, updatedTick: 0,
    };
  }
  // a few marriages
  for (let k = 0; k < 4; k++) {
    const a = rng.pick(ids), b = rng.pick(ids);
    if (a === b || citizens[a].marriedToId || citizens[b].marriedToId) continue;
    if (citizens[a].sex === citizens[b].sex) continue;
    citizens[a].marriedToId = b; citizens[b].marriedToId = a;
    relationships[relKey(a, b)] = {
      aId: a, bId: b, familiarity: 1, trust: 0.8, affection: 0.9, attraction: 0.7,
      respect: 0.7, resentment: 0, fear: 0, dependency: 0.4, loyalty: 0.9, type: "spouse", interactions: 50, updatedTick: 0,
    };
  }

  // money supply invariant: sum of all cash+bank+business funds+treasury
  let ms = 0;
  for (const c of Object.values(citizens)) ms += c.financial.cash + c.financial.bank;
  for (const b of Object.values(buildings)) ms += b.economic.funds;

  return {
    seed, cityName, citizens, buildings, jobs, relationships,
    memories: [], events: [], posts: [], goals: {},
    government: { mayorId: ids[0], taxRate: 0.1, treasury: 10000 },
    moneySupply: ms + 10000, metricsHistory: [], eventSeq: 0,
  };
}

export function totalMoney(s: WorldState): number {
  let t = s.government.treasury;
  for (const c of Object.values(s.citizens)) t += c.financial.cash + c.financial.bank - c.financial.debt;
  for (const b of Object.values(s.buildings)) {
    t += b.economic.funds;
    // inventory valued at restock cost (meal=4, others=2) so restocking conserves money
    for (const [k, v] of Object.entries(b.inventory)) t += v * (k === "meal" ? 3 : 2);
  }
  return t;
}
