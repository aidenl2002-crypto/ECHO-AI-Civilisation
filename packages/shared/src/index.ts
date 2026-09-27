// PROJECT ECHO - shared domain models. No runtime deps.

export interface Vec2 { x: number; y: number; }

export interface CityRoad { id: string; name: string; kind: 'arterial' | 'main' | 'local' | 'pedestrian'; width: number; points: Vec2[]; }
export interface CityDistrict { id: string; name: string; kind: 'downtown' | 'old_town' | 'suburb' | 'industrial' | 'civic' | 'entertainment' | 'riverside'; center: Vec2; polygon: Vec2[]; color: string; desirability: number; rentMultiplier: number; }
export interface CityGreenSpace { id: string; name: string; kind: 'park' | 'plaza' | 'woodland'; polygon: Vec2[]; }
export interface CityLayout { version: 2; width: number; height: number; boundary: Vec2[]; water: Vec2[][]; districts: CityDistrict[]; roads: CityRoad[]; greenSpaces: CityGreenSpace[]; }

export type Sex = "M" | "F";

// 18 psychology traits, normalized 0..1
export interface Psychology {
  openness: number; conscientiousness: number; extraversion: number;
  agreeableness: number; neuroticism: number; ambition: number;
  empathy: number; greed: number; honesty: number; loyalty: number;
  riskTaking: number; patience: number; curiosity: number;
  discipline: number; sociability: number; aggression: number;
  optimism: number; religiosity: number;
}
export const TRAIT_KEYS: (keyof Psychology)[] = ["openness","conscientiousness","extraversion","agreeableness","neuroticism","ambition","empathy","greed","honesty","loyalty","riskTaking","patience","curiosity","discipline","sociability","aggression","optimism","religiosity"];

// 14 skills 0..100
export interface Skills {
  farming: number; cooking: number; medicine: number; engineering: number;
  trading: number; leadership: number; combat: number; teaching: number;
  crafting: number; mining: number; fishing: number; building: number;
  music: number; science: number;
}
export const SKILL_KEYS: (keyof Skills)[] = ["farming","cooking","medicine","engineering","trading","leadership","combat","teaching","crafting","mining","fishing","building","music","science"];

// 6 emotions 0..1
export interface Emotions { joy: number; sadness: number; anger: number; fear: number; love: number; stress: number; }
export const EMOTION_KEYS: (keyof Emotions)[] = ["joy","sadness","anger","fear","love","stress"];

export interface Needs { hunger: number; energy: number; health: number; happiness: number; }
export type Activity = "sleeping" | "working" | "eating" | "leisure" | "shopping" | "idle" | "dead";

export interface Financial { cash: number; bank: number; debt: number; }

export interface Citizen {
  id: string; firstName: string; lastName: string; sex: Sex; age: number; // years
  alive: boolean;
  position: Vec2;
  homeId: string | null; workBuildingId: string | null; jobId: string | null;
  destinationBuildingId: string | null;
  currentActivity: Activity;
  physical: { height: number; health: number };
  psychology: Psychology; skills: Skills; emotions: Emotions; needs: Needs;
  financial: Financial;
  marriedToId: string | null;
  goalIds: string[];
  tickBorn: number; tickDied: number | null;
}

export type BuildingType = "town_hall" | "police" | "clinic" | "bar" | "restaurant" | "grocery" | "factory" | "warehouse" | "bank" | "school" | "park" | "home" | "shop" | "farm";
export interface Building {
  id: string; name: string; type: BuildingType; position: Vec2;
  capacity: number; ownerId: string | null; workers: string[];
  inventory: Record<string, number>; // item -> qty, never negative
  openingHours: { open: number; close: number }; // 0-24
  economic: { funds: number; priceLevel: number; wagesOwed: number; revenueToday?: number; customersToday?: number; metricDay?: number };
  districtId?: string; address?: string; variant?: string;
  footprint?: { width: number; depth: number }; height?: number; rotation?: number;
  entrance?: Vec2; propertyValue?: number; rent?: number; condition?: number; desirability?: number;
}

export interface Job {
  id: string; title: string; buildingId: string; salary: number; // weekly pay
  workerId: string | null; skillRequired: keyof Skills | null;
}

export type RelationshipType = "stranger" | "acquaintance" | "friend" | "close_friend" | "spouse" | "rival" | "enemy" | "family";
export interface Relationship {
  aId: string; bId: string;
  familiarity: number; trust: number; affection: number; attraction: number;
  respect: number; resentment: number; fear: number; dependency: number; loyalty: number;
  type: RelationshipType;
  interactions: number;
  updatedTick: number;
}
export const relKey = (a: string, b: string): string => (a < b ? `${a}_${b}` : `${b}_${a}`);

export interface MemoryEntry {
  id: string; citizenId: string; tick: number; day: number;
  salience: number; // 0..1
  text: string; tags: string[];
}

export type SimEventType =
  | "CitizenBorn" | "CitizenDied" | "Hired" | "Fired" | "Married" | "RelationshipEnded"
  | "BusinessCreated" | "BusinessClosed" | "CrimeCommitted" | "Arrested"
  | "ElectionStarted" | "ElectionWon" | "LawChanged" | "MoneyTransferred"
  | "PropertyPurchased" | "GodIntervention" | "MealEaten" | "Payday"
  | "RentPaid" | "TaxCollected" | "ChildBorn" | "MigrantArrived" | "CitizenTalked";

export interface SimEvent {
  id: string; type: SimEventType; tick: number; timestamp: number; day: number;
  actorIds: string[]; buildingId?: string;
  summary: string; data: Record<string, unknown>;
}

export interface Goal { id: string; citizenId: string; text: string; priority: number; done: boolean; createdTick: number; }
export interface EchoPost { id: string; authorId: string; text: string; tick: number; day: number; likes: number; replyToId?: string; }

// AI structured output command
export type AIAction = "CONFRONT_PERSON" | "CHANGE_GOAL" | "POST_ECHONET" | "VOTE" | "BUY" | "NONE";
export interface SimCommand { action: AIAction; targetCitizenId?: string; reason: string; confidence: number; text?: string; }

const ACTIONS: AIAction[] = ["CONFRONT_PERSON","CHANGE_GOAL","POST_ECHONET","VOTE","BUY","NONE"];

/** Manual validator for AI structured output (no extra dep). Returns {ok, errors}. */
export function validateSimCommand(cmd: unknown): { ok: boolean; errors: string[]; value: SimCommand | null } {
  const errors: string[] = [];
  if (typeof cmd !== "object" || cmd === null) return { ok: false, errors: ["not an object"], value: null };
  const c = cmd as Record<string, unknown>;
  if (!ACTIONS.includes(c.action as AIAction)) errors.push(`invalid action: ${String(c.action)}`);
  if (typeof c.reason !== "string" || c.reason.length === 0) errors.push("reason must be non-empty string");
  if (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1) errors.push("confidence must be 0..1");
  if (c.targetCitizenId !== undefined && typeof c.targetCitizenId !== "string") errors.push("targetCitizenId must be string");
  if ((c.action === "CONFRONT_PERSON" || c.action === "VOTE") && typeof c.targetCitizenId !== "string") errors.push(`${String(c.action)} requires targetCitizenId`);
  if ((c.action === "POST_ECHONET" || c.action === "CHANGE_GOAL") && typeof c.text !== "string") errors.push(`${String(c.action)} requires text`);
  if (errors.length > 0) return { ok: false, errors, value: null };
  return { ok: true, errors: [], value: c as unknown as SimCommand };
}

export function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
export function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
