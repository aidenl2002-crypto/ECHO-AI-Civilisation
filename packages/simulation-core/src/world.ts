// WorldState + world generation (deterministic from seed).
import { Building, CityLayout, Citizen, EchoPost, Goal, Job, MemoryEntry, Relationship, SimEvent, relKey, clamp01 } from "@echo/shared";
import { Rng } from "./rng.js";
import { generateCity } from "./urban.js";

export interface Government { mayorId: string | null; taxRate: number; treasury: number; }
export interface WorldMetrics { day: number; population: number; totalWealth: number; businesses: number; avgHappiness: number; avgHealth: number; employmentRate: number; moneySupply: number; }
export interface WorldState {
  seed: number; cityName: string; layout?: CityLayout;
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

export function createWorld(seed: number, cityName: string, citizenCount = 120): WorldState {
  const rng = new Rng(seed);
  const citizens: Record<string, Citizen> = {};
  const { buildings, layout } = generateCity(seed);
  const jobs: Record<string, Job> = {};
  const relationships: Record<string, Relationship> = {};

  const homes = Object.values(buildings).filter(b => b.type === "home");

  // --- citizens ---
  const ids: string[] = [];
  for (let i = 0; i < citizenCount; i++) {
    const sex = rng.next() < 0.5 ? "M" as const : "F" as const;
    const fn = sex === "M" ? rng.pick(FIRST_M) : rng.pick(FIRST_F);
    const id = `c_${i.toString().padStart(3, "0")}`;
    const age = rng.int(18, 70);
    const preferredHome = homes[i % homes.length];
    const occupancy = (id: string) => Object.values(citizens).filter(c => c.homeId === id).length;
    const home = occupancy(preferredHome.id) < preferredHome.capacity ? preferredHome : homes.find(h => occupancy(h.id) < h.capacity) ?? preferredHome;
    if (occupancy(home.id) >= home.capacity) home.capacity = occupancy(home.id) + 1;
    const cash = Math.round(rng.range(500, 5000));
    const bank = Math.round(rng.range(0, 3000));
    citizens[id] = {
      id, firstName: fn, lastName: rng.pick(LAST), sex, age, alive: true,
      position: { ...home.position },
      homeId: home.id, workBuildingId: null, jobId: null, destinationBuildingId: null,
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

  // Every commercial and civic property offers real work.
  const bizB = Object.values(buildings).filter(b => b.type !== 'home' && b.type !== 'park').map(b => b.id);
  const roles: Partial<Record<Building['type'], [string, keyof Citizen['skills'], number]>> = {
    bar:['Bartender','trading',140], restaurant:['Chef','cooking',165], grocery:['Grocer','trading',130],
    factory:['Factory Worker','engineering',150], warehouse:['Warehouse Worker','crafting',145],
    shop:['Shopkeeper','trading',135], clinic:['Nurse','medicine',190], bank:['Clerk','trading',155],
    school:['Teacher','teaching',180], police:['Police Officer','combat',180],town_hall:['City Clerk','leadership',170]
  };
  bizB.forEach((id,i) => {const [title,skill,salary]=roles[buildings[id].type] ?? ['City Worker','crafting',140]; const jid='j_'+i;
    jobs[jid]={id:jid,title,buildingId:id,salary,workerId:null,skillRequired:skill};});

  // assign ~70% employment
  const shuffle = <T>(items: T[]): T[] => { for (let i=items.length-1;i>0;i--) {const j=rng.int(0,i);[items[i],items[j]]=[items[j],items[i]];} return items; };
  const shuffled = shuffle([...ids]);
  const jobIds = shuffle(Object.keys(jobs));
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
    seed, cityName, layout, citizens, buildings, jobs, relationships,
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
