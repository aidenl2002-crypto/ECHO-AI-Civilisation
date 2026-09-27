// admin.ts — OWNER GOD CONSOLE backend.
// Auth (OWNER/ADMIN/OBSERVER/USER), AdminCommandBus, audit log, ledger,
// citizen/world/economy/government/crime/event/snapshot/time/AI/database endpoints.
import type { Express, Request, Response, NextFunction } from "express";
import { relKey, TRAIT_KEYS, SKILL_KEYS, EMOTION_KEYS } from "@echo/shared";
import type { Citizen } from "@echo/shared";
import type { WorldState } from "@echo/simulation-core";
import { totalMoney } from "@echo/simulation-core";
import { db, saveSlot, loadSlot, listSlots } from "./db.js";

export type OwnerRole = "OWNER" | "ADMIN" | "OBSERVER" | "USER";
export type Permission =
  | "world.read" | "world.modify" | "citizen.modify" | "citizen.kill" | "citizen.spawn"
  | "economy.modify" | "business.modify" | "government.modify" | "events.spawn"
  | "ai.inspect" | "ai.control" | "system.debug" | "system.database";

export const PERMISSIONS: Record<OwnerRole, Permission[]> = {
  OWNER: ["world.read", "world.modify", "citizen.modify", "citizen.kill", "citizen.spawn", "economy.modify", "business.modify", "government.modify", "events.spawn", "ai.inspect", "ai.control", "system.debug", "system.database"],
  ADMIN: ["world.read", "world.modify", "citizen.modify", "citizen.kill", "citizen.spawn", "economy.modify", "business.modify", "government.modify", "events.spawn", "ai.inspect", "ai.control", "system.debug"],
  OBSERVER: ["world.read", "ai.inspect"],
  USER: ["world.read"],
};

export function roleFromToken(token: string | undefined | null): OwnerRole | null {
  if (!token) return null;
  const owner = process.env.OWNER_TOKEN ?? "owner-dev";
  if (token === owner) return "OWNER";
  const admins = (process.env.ADMIN_TOKENS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (admins.includes(token)) return "ADMIN";
  const observers = (process.env.OBSERVER_TOKENS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (observers.includes(token)) return "OBSERVER";
  const users = (process.env.USER_TOKENS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (users.includes(token)) return "USER";
  return null;
}

export function hasPermission(role: OwnerRole, perm: Permission): boolean {
  return PERMISSIONS[role].includes(perm);
}

function tokenFromReq(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7).trim();
  const x = req.headers["x-owner-token"];
  if (typeof x === "string" && x) return x.trim();
  const q = (req.query as Record<string, unknown>).token;
  if (typeof q === "string" && q) return q;
  const b = (req.body as Record<string, unknown> | undefined)?.token;
  if (typeof b === "string" && b) return b;
  return null;
}

export interface AdminIdentity { role: OwnerRole; id: string; }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { admin?: AdminIdentity; requestId?: string; } }
}

/** Middleware: validates Bearer token on ALL /api/admin/*. Attaches req.admin. */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromReq(req);
  const role = roleFromToken(token);
  if (!role) { res.status(401).json({ error: "unauthorized: valid owner/admin token required" }); return; }
  req.requestId = `r_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  req.admin = { role, id: `${role}_${(token ?? "").slice(0, 6)}` };
  next();
}

export function requirePerm(perm: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.admin?.role;
    if (!role || !hasPermission(role, perm)) { res.status(403).json({ error: `forbidden: ${perm} required for role ${role ?? "none"}` }); return; }
    next();
  };
}

// ---------- audit log ----------
export interface AuditEntry {
  id: string; ts: number; requestId: string; actor: string; role: OwnerRole;
  action: string; target: string; before: unknown; after: unknown;
  reason: string; source: "ADMIN"; reversible: Reversibility;
}
export const auditLog: AuditEntry[] = [];
try {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY, ts INTEGER, request_id TEXT, actor TEXT, role TEXT, action TEXT, target TEXT, before_json TEXT, after_json TEXT, reason TEXT, source TEXT, reversible TEXT);
  CREATE TABLE IF NOT EXISTS admin_ledger(id TEXT PRIMARY KEY, ts INTEGER, citizen_id TEXT, kind TEXT, amount REAL, balance_after REAL, reason TEXT, actor TEXT);
  CREATE TABLE IF NOT EXISTS admin_snapshots(name TEXT PRIMARY KEY, ts INTEGER, tick INTEGER, reason TEXT, actor TEXT, size INTEGER, data TEXT);`);
} catch { /* tables best-effort */ }

export type Reversibility = "REVERSIBLE" | "SNAPSHOT-REQUIRED" | "IRREVERSIBLE";
const REVERSIBILITY_MAP: Record<string, Reversibility> = {
  kill: "SNAPSHOT-REQUIRED", extinction: "IRREVERSIBLE", mass_extinction: "IRREVERSIBLE",
  nuke_economy: "SNAPSHOT-REQUIRED", reset_ai: "SNAPSHOT-REQUIRED", bankrupt: "SNAPSHOT-REQUIRED",
  revive: "REVERSIBLE",
};
function reversibilityOf(action: string): Reversibility {
  for (const [k, v] of Object.entries(REVERSIBILITY_MAP)) if (action.includes(k)) return v;
  return "REVERSIBLE";
}

let auditSeq = 0;
export function audit(req: Request, action: string, target: string, before: unknown, after: unknown, reason = ""): AuditEntry {
  const e: AuditEntry = {
    id: `a_${Date.now()}_${auditSeq++}`, ts: Date.now(),
    requestId: req.requestId ?? "n/a", actor: req.admin?.id ?? "unknown",
    role: req.admin?.role ?? "USER", action, target, before, after,
    reason: String(reason ?? "").slice(0, 500), source: "ADMIN", reversible: reversibilityOf(action),
  };
  auditLog.push(e);
  if (auditLog.length > 2000) auditLog.splice(0, auditLog.length - 2000);
  try {
    db.prepare("INSERT OR REPLACE INTO admin_audit(id,ts,request_id,actor,role,action,target,before_json,after_json,reason,source,reversible) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(e.id, e.ts, e.requestId, e.actor, e.role, e.action, e.target, JSON.stringify(before ?? null).slice(0, 8000), JSON.stringify(after ?? null).slice(0, 8000), e.reason, "ADMIN", e.reversible);
  } catch { /* ignore */ }
  return e;
}

export function ledger(citizenId: string, kind: "ADMIN_MINT" | "ADMIN_REMOVE", amount: number, balanceAfter: number, reason: string, actor: string): void {
  try {
    db.prepare("INSERT INTO admin_ledger(id,ts,citizen_id,kind,amount,balance_after,reason,actor) VALUES(?,?,?,?,?,?,?,?)")
      .run(`l_${Date.now()}_${Math.floor(Math.random() * 1e9)}`, Date.now(), citizenId, kind, amount, balanceAfter, reason.slice(0, 300), actor);
  } catch { /* ignore */ }
}
export function ledgerFor(citizenId: string): Array<Record<string, unknown>> {
  try { return db.prepare("SELECT * FROM admin_ledger WHERE citizen_id=? ORDER BY ts DESC LIMIT 100").all(citizenId) as Array<Record<string, unknown>>; }
  catch { return []; }
}

// ---------- AdminCommandBus ----------
export interface AdminCommand { type: string; actorId: string; targetIds: string[]; payload: Record<string, unknown>; timestamp: number; }
export function makeCommand(type: string, actorId: string, targetIds: string[], payload: Record<string, unknown> = {}): AdminCommand {
  return { type, actorId, targetIds, payload, timestamp: Date.now() };
}

// ---------- pure world ops (exported for tests) ----------
let uidSeq = 0;
const uid = (p: string): string => `${p}_${Date.now().toString(36)}_${(uidSeq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

function emitEvent(state: WorldState, tick: number, day: number, type: string, summary: string, actorIds: string[], data: Record<string, unknown> = {}, buildingId?: string): void {
  state.eventSeq++;
  state.events.push({
    id: `e_${state.eventSeq}`, type: type as never, tick, timestamp: Date.now(),
    day, actorIds, buildingId, summary, data: { ...data, source: "ADMIN" },
  });
  if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
}

export function adminGiveMoney(state: WorldState, id: string, amount: number): { cash: number; kind: "ADMIN_MINT" | "ADMIN_REMOVE" } {
  const c = state.citizens[id];
  if (!c) throw new Error("citizen not found");
  const amt = Math.max(-1000000, Math.min(1000000, Math.round(Number(amount) || 0)));
  const before = c.financial.cash;
  c.financial.cash = Math.max(0, before + amt);
  return { cash: c.financial.cash, kind: amt >= 0 ? "ADMIN_MINT" : "ADMIN_REMOVE" };
}

export function adminKill(state: WorldState, tick: number, day: number, id: string, reason = ""): void {
  const c = state.citizens[id];
  if (!c) throw new Error("citizen not found");
  if (!c.alive) return;
  c.alive = false;
  c.tickDied = tick;
  c.currentActivity = "dead";
  c.destinationBuildingId = null;
  // job cleanup (no row delete)
  if (c.jobId && state.jobs[c.jobId]) state.jobs[c.jobId].workerId = null;
  for (const j of Object.values(state.jobs)) if (j.workerId === id) j.workerId = null;
  c.jobId = null;
  // business cleanup: remove from workers, transfer ownership to next worker or null
  for (const b of Object.values(state.buildings)) {
    b.workers = b.workers.filter((w) => w !== id);
    if (b.ownerId === id) b.ownerId = b.workers[0] ?? null;
  }
  if (c.workBuildingId) c.workBuildingId = null;
  // government: vacate mayor
  if (state.government.mayorId === id) state.government.mayorId = null;
  // household: keep homeId (history) but nothing else
  emitEvent(state, tick, day, "CitizenDied", `${c.firstName} ${c.lastName} was struck down by the Owner. ${reason}`.trim(), [id], { cause: "admin-kill", reason });
}

export function adminRevive(state: WorldState, tick: number, day: number, id: string): void {
  const c = state.citizens[id];
  if (!c) throw new Error("citizen not found");
  if (c.alive) return;
  c.alive = true;
  c.tickDied = null;
  c.currentActivity = "idle";
  c.needs.health = Math.max(c.needs.health, 70);
  c.needs.energy = Math.max(c.needs.energy, 60);
  emitEvent(state, tick, day, "GodIntervention", `${c.firstName} ${c.lastName} was revived by the Owner (CitizenRevivedByAdmin).`, [id], { adminKind: "CitizenRevivedByAdmin" });
}

export function adminSpawn(state: WorldState, tick: number, opts: Partial<Citizen> & { firstName?: string; lastName?: string } = {}): Citizen {
  const id = uid("c_god");
  const base: Citizen = {
    id, firstName: opts.firstName ?? "Godchild", lastName: opts.lastName ?? "Spawn",
    sex: (opts.sex as Citizen["sex"]) ?? "M", age: opts.age ?? 25, alive: true,
    position: opts.position ?? { ...(state.buildings[opts.homeId ?? 'b_home0']?.position ?? { x: (state.layout?.width ?? 1000) / 2, y: (state.layout?.height ?? 1000) / 2 }) },
    homeId: opts.homeId ?? "b_home0", workBuildingId: null, jobId: null,
    destinationBuildingId: null, currentActivity: "idle",
    physical: opts.physical ?? { height: 178, health: 85 },
    psychology: opts.psychology ?? Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0.5])) as unknown as Citizen["psychology"],
    skills: opts.skills ?? Object.fromEntries(SKILL_KEYS.map((k) => [k, 20])) as unknown as Citizen["skills"],
    emotions: opts.emotions ?? { joy: 0.5, sadness: 0.1, anger: 0, fear: 0.1, love: 0.3, stress: 0.2 },
    needs: opts.needs ?? { hunger: 80, energy: 90, health: 85, happiness: 60 },
    financial: opts.financial ?? { cash: 500, bank: 0, debt: 0 },
    marriedToId: null, goalIds: [], tickBorn: tick, tickDied: null,
  };
  state.citizens[id] = base;
  return base;
}

export function filterCitizens(state: WorldState, filter: Record<string, unknown> = {}): Citizen[] {
  let all = Object.values(state.citizens);
  const alive = filter.alive;
  if (alive === true || alive === "alive") all = all.filter((c) => c.alive);
  if (alive === false || alive === "dead") all = all.filter((c) => !c.alive);
  if (typeof filter.jobless === "boolean") all = all.filter((c) => filter.jobless ? !c.jobId : !!c.jobId);
  if (typeof filter.minWealth === "number") all = all.filter((c) => c.financial.cash + c.financial.bank >= (filter.minWealth as number));
  if (typeof filter.maxWealth === "number") all = all.filter((c) => c.financial.cash + c.financial.bank <= (filter.maxWealth as number));
  if (typeof filter.minAge === "number") all = all.filter((c) => c.age >= (filter.minAge as number));
  if (typeof filter.maxAge === "number") all = all.filter((c) => c.age <= (filter.maxAge as number));
  if (typeof filter.q === "string" && filter.q) {
    const q = (filter.q as string).toLowerCase();
    all = all.filter((c) => `${c.firstName} ${c.lastName} ${c.id}`.toLowerCase().includes(q));
  }
  if (typeof filter.ids === "string" && filter.ids) {
    const set = new Set((filter.ids as string).split(",").map((s) => s.trim()));
    all = all.filter((c) => set.has(c.id));
  }
  if (Array.isArray(filter.ids)) { const set = new Set(filter.ids as string[]); all = all.filter((c) => set.has(c.id)); }
  const limit = Math.min(500, Math.max(1, Number(filter.limit ?? 200)));
  return all.slice(0, limit);
}

export function verifyWorld(state: WorldState): Array<{ check: string; ok: boolean; detail: string }> {
  const out: Array<{ check: string; ok: boolean; detail: string }> = [];
  const negInv = Object.values(state.buildings).flatMap((b) => Object.entries(b.inventory).filter(([, v]) => v < 0).map(([k, v]) => `${b.id}.${k}=${v}`));
  out.push({ check: "inventory-nonnegative", ok: negInv.length === 0, detail: negInv.slice(0, 5).join(", ") || "ok" });
  const negFunds = Object.values(state.buildings).filter((b) => b.economic.funds < 0).map((b) => b.id);
  out.push({ check: "funds-nonnegative", ok: negFunds.length === 0, detail: negFunds.slice(0, 5).join(", ") || "ok" });
  const deadActing = Object.values(state.citizens).filter((c) => !c.alive && (c.currentActivity !== "dead" || c.destinationBuildingId || c.jobId)).map((c) => c.id);
  out.push({ check: "dead-cannot-act", ok: deadActing.length === 0, detail: deadActing.slice(0, 5).join(", ") || "ok" });
  const badRel = Object.entries(state.relationships).filter(([k, r]) => !state.citizens[r.aId] || !state.citizens[r.bId] || k !== relKey(r.aId, r.bId)).map(([k]) => k);
  out.push({ check: "relationships-valid", ok: badRel.length === 0, detail: badRel.slice(0, 5).join(", ") || "ok" });
  const oob = Object.values(state.citizens).filter((c) => !Number.isFinite(c.position.x) || !Number.isFinite(c.position.y) || c.position.x < 0 || c.position.x > (state.layout?.width ?? 1000) || c.position.y < 0 || c.position.y > (state.layout?.height ?? 1000)).map((c) => c.id);
  out.push({ check: "positions-in-bounds", ok: oob.length === 0, detail: oob.slice(0, 5).join(", ") || "ok" });
  let mono = true; let last = -1;
  for (const e of state.events) { if (e.tick < last) { mono = false; break; } last = e.tick; }
  out.push({ check: "events-monotonic", ok: mono, detail: mono ? "ok" : "tick went backwards" });
  const negCash = Object.values(state.citizens).filter((c) => c.financial.cash < 0 || c.financial.bank < 0).map((c) => c.id);
  out.push({ check: "wallets-nonnegative", ok: negCash.length === 0, detail: negCash.slice(0, 5).join(", ") || "ok" });
  return out;
}

/** Natural-language command-bar parser -> approved actions only. Never shell. */
export function parseAdminCommand(text: string): { actions: AdminCommand[]; warnings: string[]; rejected: boolean; summary: string } {
  const t = text.trim();
  const warnings: string[] = [];
  const actions: AdminCommand[] = [];
  if (!t) return { actions, warnings: ["empty command"], rejected: true, summary: "empty" };
  if (/rm\s+-rf|;|\$\(|`|:?\(\s*\)\s*\{/.test(t)) return { actions, warnings: ["shell-like input rejected"], rejected: true, summary: "rejected: shell" };
  const low = t.toLowerCase();
  let m: RegExpMatchArray | null;
  const num = (s: string): number => Number(s.replace(/,/g, ""));
  if ((m = low.match(/give\s+(-?[\d,]+)\s+(?:to\s+)?(.+)/))) {
    actions.push(makeCommand("citizen.money", "command-bar", [m[2].trim()], { amount: num(m[1]) }));
  } else if ((m = low.match(/remove\s+([\d,]+)\s+(?:from\s+)?(.+)/))) {
    actions.push(makeCommand("citizen.money", "command-bar", [m[2].trim()], { amount: -num(m[1]) }));
  } else if ((m = low.match(/kill\s+(.+)/))) {
    actions.push(makeCommand("citizen.kill", "command-bar", [m[1].trim()], {}));
  } else if ((m = low.match(/revive\s+(.+)/))) {
    actions.push(makeCommand("citizen.revive", "command-bar", [m[1].trim()], {}));
  } else if ((m = low.match(/heal\s+(.+)/))) {
    actions.push(makeCommand("citizen.heal", "command-bar", [m[1].trim()], {}));
  } else if ((m = low.match(/teleport\s+(\S+)\s+to\s+(\S+)(?:\s+(\S+))?/))) {
    actions.push(makeCommand("citizen.teleport", "command-bar", [m[1].trim()], { x: Number(m[2]), y: m[3] ? Number(m[3]) : undefined }));
  } else if ((m = low.match(/spawn\s+(\d+)?\s*(.*)/))) {
    actions.push(makeCommand("citizens.spawn", "command-bar", [], { count: Math.min(50, Number(m[1] ?? 1) || 1), preset: m[2].trim() || undefined }));
  } else if (/mass extinction|extinction/.test(low)) {
    actions.push(makeCommand("world.extinction", "command-bar", [], { confirm: /confirm/.test(low) }));
    if (!/confirm/.test(low)) warnings.push("extinction requires typing CONFIRM in console");
  } else if (/miracle/.test(low)) {
    actions.push(makeCommand("world.miracle", "command-bar", [], { kind: "blessing" }));
  } else if ((m = low.match(/money drop\s+([\d,]+)?/))) {
    actions.push(makeCommand("economy.money_drop", "command-bar", [], { amount: Number((m[1] ?? "1000").replace(/,/g, "")) }));
  } else if (/nuke economy|nuke/.test(low)) {
    actions.push(makeCommand("economy.nuke", "command-bar", [], {}));
  } else if (/boom/.test(low)) { actions.push(makeCommand("economy.boom", "command-bar", [], {})); }
  else if (/recession/.test(low)) { actions.push(makeCommand("economy.recession", "command-bar", [], {})); }
  else if (/random chaos/.test(low)) { actions.push(makeCommand("world.chaos", "command-bar", [], { kind: "chaos" })); }
  else if (/blessing/.test(low)) { actions.push(makeCommand("world.chaos", "command-bar", [], { kind: "blessing" })); }
  else if ((m = low.match(/pause\s+ai|ai\s+pause/))) { actions.push(makeCommand("ai.pause", "command-bar", [], {})); }
  else if ((m = low.match(/resume\s+ai|ai\s+resume/))) { actions.push(makeCommand("ai.resume", "command-bar", [], {})); }
  else if ((m = low.match(/(?:pause|resume|step|speed)\s*(.*)/))) {
    if (/step/.test(low)) { const n = low.match(/step\s+(\d+)/); actions.push(makeCommand("time.step", "command-bar", [], { n: n ? Number(n[1]) : 1 })); }
    else if (/speed/.test(low)) { const n = low.match(/speed\s+(\d+)/); actions.push(makeCommand("time.speed", "command-bar", [], { speed: n ? Number(n[1]) : 1 })); }
    else actions.push(makeCommand("time.pause", "command-bar", [], { paused: !/resume/.test(low) }));
  } else if ((m = low.match(/make\s+(\S.+?)\s+mayor/))) {
    actions.push(makeCommand("government.mayor", "command-bar", [m[1].trim()], {}));
  } else if ((m = low.match(/tax\s+(\d+(?:\.\d+)?)/))) {
    actions.push(makeCommand("government.tax", "command-bar", [], { taxRate: Number(m[1]) / 100 }));
  } else if ((m = low.match(/elect|election/))) {
    actions.push(makeCommand("government.election", "command-bar", [], {}));
  } else if ((m = low.match(/arrest\s+(.+)/))) {
    actions.push(makeCommand("crime.arrest", "command-bar", [m[1].trim()], {}));
  } else if ((m = low.match(/event\s+(\w+)\s+(.+)/))) {
    actions.push(makeCommand("events.spawn", "command-bar", [], { type: m[1], summary: m[2] }));
  } else if ((m = low.match(/rumou?r\s+(.+)/))) {
    actions.push(makeCommand("events.rumour", "command-bar", [], { text: m[1] }));
  } else if ((m = low.match(/force.?think\s+(\S+)?/))) {
    actions.push(makeCommand("ai.force_think", "command-bar", m[1] ? [m[1].trim()] : [], {}));
  } else if ((m = low.match(/clone\s+(.+)/))) {
    actions.push(makeCommand("citizen.clone", "command-bar", [m[1].trim()], {}));
  } else if ((m = low.match(/immortal\s+(\S+)?/))) {
    actions.push(makeCommand("citizen.immortal", "command-bar", m[1] ? [m[1].trim()] : [], { on: !/off/.test(low) }));
  } else {
    return { actions, warnings: [`no approved action matches: "${t.slice(0, 80)}"`], rejected: true, summary: "no match" };
  }
  return { actions, warnings, rejected: false, summary: actions.map((a) => a.type).join(", ") };
}

// ---------- route registration ----------
export interface AdminDeps {
  engine: { state: WorldState; clock: { tick: number; day: number; hour: number }; speed: number; paused: boolean; tick(): void; save(): string; load(s: string): void; snapshot(): unknown };
  afterTicks(n: number): void;
  aiConfig: { backgroundEnabled: boolean; intensity: number };
  brainProvider: { enabled: boolean };
  enqueueFor?(citizenId: string, type: never, role: never, reason: string): string | null;
  scheduler?: { queue: unknown[] };
}

const immortals = new Set<string>();
const possessed = new Set<string>();
export function isImmortal(id: string): boolean { return immortals.has(id); }
export function isPossessed(id: string): boolean { return possessed.has(id); }

function resolveId(state: WorldState, ref: string): string | null {
  if (state.citizens[ref]) return ref;
  const low = ref.toLowerCase();
  const hit = Object.values(state.citizens).find((c) => `${c.firstName} ${c.lastName}`.toLowerCase() === low || `${c.firstName}`.toLowerCase() === low || c.id.toLowerCase() === low);
  return hit ? hit.id : null;
}

function autoSnapshot(deps: AdminDeps, actor: string, reason: string): string {
  const name = `auto_${Date.now()}`;
  try {
    db.prepare("INSERT OR REPLACE INTO admin_snapshots(name,ts,tick,reason,actor,size,data) VALUES(?,?,?,?,?,?,?)")
      .run(name, Date.now(), deps.engine.clock.tick, reason.slice(0, 300), actor, deps.engine.save().length, deps.engine.save());
  } catch { /* ignore */ }
  try { saveSlot(`god_${name}`, deps.engine.save()); } catch { /* ignore */ }
  return name;
}

function snapshotMeta(): Array<Record<string, unknown>> {
  try { return db.prepare("SELECT name,ts,tick,reason,actor,size FROM admin_snapshots ORDER BY ts DESC LIMIT 100").all() as Array<Record<string, unknown>>; }
  catch { return []; }
}

export function registerAdminRoutes(app: Express, deps: AdminDeps): void {
  const { engine } = deps;
  const S = (): WorldState => engine.state as WorldState;
  app.use("/api/admin", adminAuth);

  // read-only world summary
  app.get("/api/admin/whoami", requirePerm("world.read"), (req, res) => {
    res.json({ role: req.admin?.role, permissions: req.admin ? PERMISSIONS[req.admin.role] : [] });
  });

  // ----- citizens search -----
  app.get("/api/admin/citizens", requirePerm("world.read"), (req, res) => {
    const q = req.query as Record<string, string>;
    let list = filterCitizens(S(), { ...q, alive: q.alive === "dead" ? false : q.alive === "all" ? undefined : true, limit: Number(q.limit ?? 200) });
    const sort = q.sort ?? "wealth";
    const val = (c: Citizen): number | string => {
      if (sort === "age") return c.age;
      if (sort === "health") return c.needs.health;
      if (sort === "mood") return c.needs.happiness;
      if (sort === "name") return `${c.firstName} ${c.lastName}`;
      return c.financial.cash + c.financial.bank;
    };
    list = [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string") return q.order === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return q.order === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    res.json(list.map((c) => ({
      id: c.id, name: `${c.firstName} ${c.lastName}`, age: c.age, alive: c.alive,
      wealth: c.financial.cash + c.financial.bank, cash: c.financial.cash, bank: c.financial.bank, debt: c.financial.debt,
      x: Math.round(c.position.x), y: Math.round(c.position.y), health: Math.round(c.needs.health),
      mood: Math.round(c.needs.happiness), job: c.jobId ?? null, activity: c.currentActivity,
      immortal: immortals.has(c.id), possessed: possessed.has(c.id),
    })));
  });

  // ----- full admin profile (14 sections + raw JSON) -----
  app.get("/api/admin/citizens/:id/full", requirePerm("world.read"), (req, res) => {
    const c = S().citizens[req.params.id];
    if (!c) { res.status(404).json({ error: "not found" }); return; }
    const st = S();
    const rels = Object.values(st.relationships).filter((r) => r.aId === c.id || r.bId === c.id)
      .map((r) => ({ ...r, otherId: r.aId === c.id ? r.bId : r.aId, otherName: st.citizens[r.aId === c.id ? r.bId : r.aId] ? `${st.citizens[r.aId === c.id ? r.bId : r.aId].firstName} ${st.citizens[r.aId === c.id ? r.bId : r.aId].lastName}` : "?" }));
    let beliefs: unknown[] = []; let secrets: unknown[] = []; let mind: unknown = null;
    try {
      beliefs = db.prepare("SELECT * FROM belief WHERE citizen_id=? ORDER BY tick DESC LIMIT 50").all(c.id) as unknown[];
      secrets = db.prepare("SELECT * FROM secret WHERE holder_id=? OR about_id=? ORDER BY tick DESC LIMIT 50").all(c.id, c.id) as unknown[];
      const mr = db.prepare("SELECT data FROM citizen_mind WHERE citizen_id=?").get(c.id) as { data: string } | undefined;
      mind = mr ? JSON.parse(mr.data) : null;
    } catch { /* ignore */ }
    res.json({
      identity: { id: c.id, name: `${c.firstName} ${c.lastName}`, sex: c.sex, age: c.age, alive: c.alive, tickBorn: c.tickBorn, tickDied: c.tickDied, immortal: immortals.has(c.id), possessed: possessed.has(c.id) },
      position: { ...c.position, homeId: c.homeId, home: c.homeId ? st.buildings[c.homeId]?.name ?? c.homeId : "homeless", workBuildingId: c.workBuildingId, destination: c.destinationBuildingId },
      work: { jobId: c.jobId, job: c.jobId ? st.jobs[c.jobId] ?? null : null, activity: c.currentActivity },
      needs: c.needs, mood: c.emotions, health: { physical: c.physical, health: c.needs.health },
      personality: c.psychology, skills: c.skills,
      finances: { ...c.financial, wealth: c.financial.cash + c.financial.bank, ledger: ledgerFor(c.id) },
      relationships: rels,
      memories: st.memories.filter((m) => m.citizenId === c.id).slice(-50).reverse(),
      beliefs, secrets,
      goals: c.goalIds.map((g) => st.goals[g]).filter(Boolean),
      family: { marriedToId: c.marriedToId, spouse: c.marriedToId && st.citizens[c.marriedToId] ? `${st.citizens[c.marriedToId].firstName} ${st.citizens[c.marriedToId].lastName}` : null },
      ai: { mind, possessed: possessed.has(c.id) },
      events: st.events.filter((e) => e.actorIds.includes(c.id)).slice(-20).reverse(),
      posts: st.posts.filter((p) => p.authorId === c.id).slice(-10).reverse(),
      raw: c,
    });
  });

  const mut = (perm: Permission, handler: (req: Request, res: Response) => void) =>
    [requirePerm(perm), (req: Request, res: Response) => {
      try { handler(req, res); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
    }] as never[];

  // ----- money (ADMIN_MINT / ADMIN_REMOVE ledger) -----
  app.post("/api/admin/citizens/:id/money", ...mut("economy.modify", (req, res) => {
    const c = S().citizens[req.params.id]; if (!c) { res.status(404).json({ error: "not found" }); return; }
    const before = { ...c.financial };
    const r = adminGiveMoney(S(), c.id, Number((req.body as { amount?: number }).amount ?? 0));
    ledger(c.id, r.kind, Number((req.body as { amount?: number }).amount ?? 0), r.cash, String((req.body as { reason?: string }).reason ?? "god console"), req.admin!.id);
    emitEvent(S(), engine.clock.tick, engine.clock.day, "MoneyTransferred", `Owner ${r.kind === "ADMIN_MINT" ? "granted" : "removed"} ${Math.abs(Number((req.body as { amount?: number }).amount ?? 0))} ${r.kind === "ADMIN_MINT" ? "to" : "from"} ${c.firstName} (${r.kind})`, [c.id], { kind: r.kind, amount: Number((req.body as { amount?: number }).amount ?? 0) });
    audit(req, "citizen.money", c.id, before, { ...c.financial }, String((req.body as { reason?: string }).reason ?? ""));
    res.json({ ok: true, cash: r.cash, ledger: r.kind, financial: c.financial });
  }));

  // ----- generic single-citizen ops -----
  const OP_PERM: Record<string, Permission> = {
    heal: "citizen.modify", injure: "citizen.modify", kill: "citizen.kill", revive: "citizen.modify",
    age: "citizen.modify", teleport: "citizen.modify", job: "citizen.modify", fire: "citizen.modify",
    housing: "citizen.modify", rich: "economy.modify", bankrupt: "economy.modify", debt: "economy.modify",
    mayor: "government.modify", office: "government.modify", fame: "citizen.modify", reputation: "citizen.modify",
    skills: "citizen.modify", personality: "citizen.modify", mood: "citizen.modify", memory: "citizen.modify",
    belief: "citizen.modify", secret: "events.spawn", goal: "citizen.modify", relationship: "citizen.modify",
    effect: "citizen.modify", immortal: "citizen.modify", clone: "citizen.spawn", "reset-ai": "ai.control",
  };
  app.post("/api/admin/citizens/:id/:op", (req, res, next) => {
    const perm = OP_PERM[req.params.op];
    if (!perm) { res.status(404).json({ error: `unknown op ${req.params.op} (SYSTEM NOT IMPLEMENTED)` }); return; }
    if (!req.admin || !hasPermission(req.admin.role, perm)) { res.status(403).json({ error: `forbidden: ${perm} required` }); return; }
    next();
  }, (req, res) => {
    try {
      const st = S(); const id = req.params.id; const op = req.params.op;
      const c = st.citizens[id];
      if (!c && op !== "clone") { res.status(404).json({ error: "citizen not found" }); return; }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const before = c ? JSON.parse(JSON.stringify(c)) : null;
      if ((op === "kill" || op === "bankrupt") && c && c.alive) autoSnapshot(deps, req.admin!.id, `${op} ${id}`);
      const done = (after: unknown = null): void => {
        audit(req, `citizen.${op}`, id, before, after ?? (c ? { ...c.financial, alive: c.alive } : null), String(b.reason ?? ""));
        res.json({ ok: true, id, op, citizen: c ?? undefined });
      };
      switch (op) {
        case "heal": c!.needs.health = 100; c!.physical.health = 100; c!.needs.energy = Math.max(c!.needs.energy, 80); emitEvent(st, engine.clock.tick, engine.clock.day, "GodIntervention", `Owner healed ${c!.firstName}`, [id], { kind: "heal" }); return done();
        case "injure": c!.needs.health = Math.max(0, c!.needs.health - Number(b.amount ?? 30)); emitEvent(st, engine.clock.tick, engine.clock.day, "GodIntervention", `Owner injured ${c!.firstName}`, [id], { kind: "injure" }); return done();
        case "kill":
          if (immortals.has(id)) { res.status(400).json({ error: "citizen is IMMORTAL — disable immortality first" }); return; }
          adminKill(st, engine.clock.tick, engine.clock.day, id, String(b.reason ?? "")); return done();
        case "revive": adminRevive(st, engine.clock.tick, engine.clock.day, id); return done();
        case "age": {
          if (typeof b.age === "number") c!.age = Math.max(0, Math.min(150, Math.round(b.age)));
          else c!.age = Math.max(0, Math.min(150, c!.age + Math.round(Number(b.delta ?? 1))));
          return done();
        }
        case "teleport": {
          if (typeof b.buildingId === "string" && st.buildings[b.buildingId as string]) {
            c!.position = { ...st.buildings[b.buildingId as string].position };
          } else {
            const x = Number(b.x ?? c!.position.x), y = Number(b.y ?? c!.position.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) { res.status(400).json({error:'Coordinates must be finite numbers'}); return; }
            c!.position = { x: Math.max(0, Math.min(st.layout?.width ?? 1000, x)), y: Math.max(0, Math.min(st.layout?.height ?? 1000, y)) };
          }
          c!.destinationBuildingId = null; return done();
        }
        case "job": {
          const jid = b.jobId as string | undefined;
          const job = jid ? st.jobs[jid] : Object.values(st.jobs).find((j) => !j.workerId && (!b.buildingId || j.buildingId === b.buildingId));
          if (!job) { res.status(400).json({ error: "no open job (specify jobId)" }); return; }
          if (c!.jobId && st.jobs[c!.jobId]) st.jobs[c!.jobId].workerId = null;
          job.workerId = id; c!.jobId = job.id; c!.workBuildingId = job.buildingId;
          if (!st.buildings[job.buildingId].workers.includes(id)) st.buildings[job.buildingId].workers.push(id);
          emitEvent(st, engine.clock.tick, engine.clock.day, "Hired", `Owner employed ${c!.firstName} as ${job.title}`, [id], { jobId: job.id }, job.buildingId); return done();
        }
        case "fire": {
          if (c!.jobId && st.jobs[c!.jobId]) st.jobs[c!.jobId].workerId = null;
          if (c!.workBuildingId && st.buildings[c!.workBuildingId]) st.buildings[c!.workBuildingId].workers = st.buildings[c!.workBuildingId].workers.filter((w) => w !== id);
          c!.jobId = null; c!.workBuildingId = null;
          emitEvent(st, engine.clock.tick, engine.clock.day, "Fired", `Owner fired ${c!.firstName}`, [id], {}); return done();
        }
        case "housing": {
          const hid = String(b.homeId ?? "b_home0");
          if (!st.buildings[hid]) { res.status(400).json({ error: "unknown homeId" }); return; }
          c!.homeId = hid; c!.position = { ...st.buildings[hid].position }; return done();
        }
        case "rich": {
          const amt = Number(b.amount ?? 50000);
          c!.financial.cash += amt; ledger(id, "ADMIN_MINT", amt, c!.financial.cash, "rich", req.admin!.id);
          emitEvent(st, engine.clock.tick, engine.clock.day, "MoneyTransferred", `Owner made ${c!.firstName} rich (+${amt} ADMIN_MINT)`, [id], { kind: "ADMIN_MINT", amount: amt }); return done();
        }
        case "bankrupt": c!.financial.cash = 0; c!.financial.bank = 0; ledger(id, "ADMIN_REMOVE", -(before.financial.cash + before.financial.bank), 0, "bankrupt", req.admin!.id); emitEvent(st, engine.clock.tick, engine.clock.day, "MoneyTransferred", `Owner bankrupted ${c!.firstName} (ADMIN_REMOVE)`, [id], { kind: "ADMIN_REMOVE" }); return done();
        case "debt": c!.financial.debt = Math.max(0, Number(b.amount ?? 1000)); return done();
        case "mayor": st.government.mayorId = id; emitEvent(st, engine.clock.tick, engine.clock.day, "ElectionWon", `Owner appointed ${c!.firstName} ${c!.lastName} mayor`, [id], {}); return done();
        case "office": emitEvent(st, engine.clock.tick, engine.clock.day, "ElectionWon", `Owner granted office "${String(b.title ?? "Councilor")}" to ${c!.firstName}`, [id], { title: b.title }); return done({ title: b.title });
        case "fame": case "reputation": {
          st.memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.9, text: `ADMIN ${op}: ${String(b.text ?? b.delta ?? "+fame")} (citywide renown ${Number(b.delta ?? 10)})`, tags: ["admin", op] });
          emitEvent(st, engine.clock.tick, engine.clock.day, "GodIntervention", `Owner adjusted ${op} of ${c!.firstName} by ${String(b.delta ?? "")}`, [id], { kind: op, delta: b.delta }); return done();
        }
        case "skills": {
          for (const k of SKILL_KEYS) if (typeof b[k] === "number") c!.skills[k] = Math.max(0, Math.min(100, Math.round(Number(b[k]))));
          if (b.skills && typeof b.skills === "object") for (const [k, v] of Object.entries(b.skills as Record<string, number>)) if ((SKILL_KEYS as string[]).includes(k)) c!.skills[k as keyof Citizen["skills"]] = Math.max(0, Math.min(100, Math.round(Number(v))));
          return done();
        }
        case "personality": {
          for (const k of TRAIT_KEYS) if (typeof b[k] === "number") c!.psychology[k] = Math.max(0, Math.min(1, Number(b[k])));
          if (b.traits && typeof b.traits === "object") for (const [k, v] of Object.entries(b.traits as Record<string, number>)) if ((TRAIT_KEYS as string[]).includes(k)) c!.psychology[k as keyof Citizen["psychology"]] = Math.max(0, Math.min(1, Number(v)));
          return done();
        }
        case "mood": {
          for (const k of EMOTION_KEYS) if (typeof b[k] === "number") c!.emotions[k] = Math.max(0, Math.min(1, Number(b[k])));
          if (typeof b.hunger === "number") c!.needs.hunger = b.hunger as number;
          if (typeof b.energy === "number") c!.needs.energy = b.energy as number;
          if (typeof b.health === "number") c!.needs.health = b.health as number;
          if (typeof b.happiness === "number") c!.needs.happiness = b.happiness as number;
          return done();
        }
        case "memory": {
          const text = String(b.text ?? "");
          if (!text) { res.status(400).json({ error: "text required" }); return; }
          const implant = Boolean(b.implantFalse ?? b.implant);
          st.memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: Number(b.salience ?? 0.8), text: implant ? `[IMPLANTED FALSE MEMORY — ADMIN] ${text}` : text, tags: implant ? ["admin", "implanted-false-memory"] : ["admin", "memory"] });
          return done();
        }
        case "belief": {
          try { db.prepare("INSERT INTO belief(citizen_id,subject,claim,confidence,source,provenance,tick) VALUES(?,?,?,?,?,?,?)").run(id, String(b.subject ?? "world"), String(b.claim ?? ""), Number(b.confidence ?? 0.8), "ADMIN", "god-console", engine.clock.tick); } catch { /* ignore */ }
          st.memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.7, text: `[ADMIN BELIEF IMPLANT] ${String(b.subject ?? "")}: ${String(b.claim ?? "")}`, tags: ["admin", "belief"] });
          return done();
        }
        case "secret": {
          const sid = uid("s");
          try { db.prepare("INSERT OR REPLACE INTO secret(id,holder_id,about_id,text,known_to,tick) VALUES(?,?,?,?,?,?)").run(sid, id, String(b.aboutId ?? id), String(b.text ?? ""), JSON.stringify([]), engine.clock.tick); } catch { /* ignore */ }
          st.memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.9, text: `[ADMIN SECRET] ${String(b.text ?? "")}`, tags: ["admin", "secret"] });
          return done({ secretId: sid });
        }
        case "goal": {
          const gid = uid("g");
          st.goals[gid] = { id: gid, citizenId: id, text: String(b.text ?? "Serve the Owner").slice(0, 200), priority: Number(b.priority ?? 0.9), done: false, createdTick: engine.clock.tick };
          c!.goalIds.push(gid); return done(st.goals[gid]);
        }
        case "relationship": {
          const other = resolveId(st, String(b.otherId ?? b.other ?? ""));
          if (!other || !st.citizens[other]) { res.status(400).json({ error: "other citizen not found" }); return; }
          const key = relKey(id, other);
          const patch = (b.patch ?? b) as Record<string, unknown>;
          const cur = (st.relationships[key] ?? { aId: key.split("_")[0] === id ? id : other, bId: key.split("_")[0] === id ? other : id, familiarity: 0.3, trust: 0.5, affection: 0, attraction: 0, respect: 0.3, resentment: 0, fear: 0, dependency: 0, loyalty: 0, type: "acquaintance", interactions: 0, updatedTick: engine.clock.tick }) as unknown as Record<string, unknown>;
          for (const f of ["familiarity", "trust", "affection", "attraction", "respect", "resentment", "fear", "dependency", "loyalty"]) if (typeof patch[f] === "number") cur[f] = Math.max(0, Math.min(1, Number(patch[f])));
          if (typeof patch.type === "string") cur["type"] = patch.type;
          cur["interactions"] = Number(cur["interactions"] ?? 0) + 1; cur["updatedTick"] = engine.clock.tick;
          st.relationships[key] = cur as unknown as never;
          return done(cur);
        }
        case "effect": st.memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.8, text: `[ADMIN EFFECT] ${String(b.text ?? b.kind ?? "blessed")}`, tags: ["admin", "effect"] }); emitEvent(st, engine.clock.tick, engine.clock.day, "GodIntervention", `Owner placed effect on ${c!.firstName}: ${String(b.text ?? b.kind ?? "")}`, [id], { kind: "effect" }); return done();
        case "immortal": {
          const on = b.on === undefined ? !immortals.has(id) : Boolean(b.on);
          if (on) immortals.add(id); else immortals.delete(id);
          return done({ immortal: on });
        }
        case "clone": {
          const src = st.citizens[id]; if (!src) { res.status(404).json({ error: "not found" }); return; }
          const copy = adminSpawn(st, engine.clock.tick, { firstName: src.firstName, lastName: `${src.lastName}-clone`, sex: src.sex, age: src.age, psychology: { ...src.psychology }, skills: { ...src.skills }, financial: { cash: Number(b.cash ?? 500), bank: 0, debt: 0 } });
          emitEvent(st, engine.clock.tick, engine.clock.day, "CitizenBorn", `Owner cloned ${src.firstName} -> ${copy.firstName} ${copy.lastName} (${copy.id})`, [copy.id], { cloneOf: id });
          audit(req, "citizen.clone", copy.id, null, { cloneOf: id }, String(b.reason ?? ""));
          res.json({ ok: true, id: copy.id, op, citizen: copy }); return;
        }
        case "reset-ai": {
          try { db.prepare("DELETE FROM citizen_mind WHERE citizen_id=?").run(id); db.prepare("DELETE FROM memory WHERE citizen_id=?").run(id); } catch { /* ignore */ }
          st.memories = st.memories.filter((m) => m.citizenId !== id);
          audit(req, "citizen.reset-ai", id, before, null, String(b.reason ?? "")); res.json({ ok: true, id, op }); return;
        }
        default: res.status(404).json({ error: "SYSTEM NOT IMPLEMENTED", op }); return;
      }
    } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
  });

  // ----- spawn / preset / bulk -----
  app.post("/api/admin/citizens/spawn", requirePerm("citizen.spawn"), (req, res) => {
    try {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const count = Math.min(50, Math.max(1, Number(b.count ?? 1)));
      const preset = String(b.preset ?? "");
      const out: Citizen[] = [];
      for (let i = 0; i < count; i++) {
        const c = adminSpawn(S(), engine.clock.tick, {
          firstName: (b.firstName as string) ?? (preset === "legend" ? "Legend" : preset === "chaos" ? "Chaos" : "Godchild"),
          lastName: (b.lastName as string) ?? `Spawn${i}`,
          age: Number(b.age ?? 25),
          psychology: preset === "legend" ? Object.fromEntries(TRAIT_KEYS.map((k) => [k, ["ambition", "leadership", "discipline"].includes(k) ? 0.95 : 0.6])) as unknown as Citizen["psychology"] : preset === "chaos" ? Object.fromEntries(TRAIT_KEYS.map((k) => [k, k === "agreeableness" || k === "honesty" ? 0.05 : 0.9])) as unknown as Citizen["psychology"] : undefined,
          skills: preset === "legend" ? Object.fromEntries(SKILL_KEYS.map((k) => [k, 85])) as unknown as Citizen["skills"] : undefined,
          financial: { cash: Number(b.cash ?? (preset === "legend" ? 20000 : 500)), bank: 0, debt: 0 },
        });
        if (preset === "chaos" || preset === "agent-of-chaos") {
          S().memories.push({ id: uid("m"), citizenId: c.id, tick: engine.clock.tick, day: engine.clock.day, salience: 1, text: "[ADMIN] Born as an Agent of Chaos", tags: ["admin", "chaos-agent"] });
        }
        out.push(c);
      }
      emitEvent(S(), engine.clock.tick, engine.clock.day, "MigrantArrived", `Owner spawned ${out.length} citizen(s)${preset ? ` (preset ${preset})` : ""}`, out.map((c) => c.id), { preset, count });
      audit(req, "citizens.spawn", out.map((c) => c.id).join(","), null, { count, preset }, String((req.body as { reason?: string })?.reason ?? ""));
      res.json({ ok: true, ids: out.map((c) => c.id), citizens: out });
    } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
  });
  app.post("/api/admin/citizens/preset", requirePerm("citizen.spawn"), (req, res) => {
    const preset = String((req.body as { preset?: string }).preset ?? "legend");
    if (!["legend", "agent-of-chaos", "chaos", "migrant", "tycoon"].includes(preset)) { res.status(400).json({ error: `unknown preset ${preset}` }); return; }
    const cash = preset === "legend" || preset === "tycoon" ? 50000 : 500;
    const c = adminSpawn(S(), engine.clock.tick, {
      firstName: preset === "legend" ? "Legend" : preset === "tycoon" ? "Tycoon" : "Chaos",
      lastName: "Arrives",
      skills: preset === "legend" || preset === "tycoon" ? Object.fromEntries(SKILL_KEYS.map((k) => [k, 90])) as unknown as Citizen["skills"] : undefined,
      financial: { cash, bank: 0, debt: 0 },
    });
    ledger(c.id, "ADMIN_MINT", cash, cash, `preset ${preset}`, req.admin!.id);
    emitEvent(S(), engine.clock.tick, engine.clock.day, "MigrantArrived", `Owner spawned preset ${preset}: ${c.firstName} ${c.lastName}`, [c.id], { preset });
    audit(req, "citizens.preset", c.id, null, { preset }, preset);
    res.json({ ok: true, id: c.id, preset, citizen: c });
  });

  // ----- mass extinction / miracle / money drop / nuke / chaos / pick / possess -----
  app.post("/api/admin/extinction", requirePerm("citizen.kill"), (req, res) => {
    try {
      const b = (req.body ?? {}) as Record<string, unknown>;
      if (String(b.confirm ?? b.type ?? "").toUpperCase() !== "EXTINCTION" && b.confirm !== true) {
        res.status(400).json({ error: 'refused: send {"confirm":"EXTINCTION"} to arm mass extinction' }); return;
      }
      autoSnapshot(deps, req.admin!.id, "mass-extinction");
      const targets = filterCitizens(S(), { ...(b.filter as Record<string, unknown> ?? {}), alive: true, limit: 500 });
      const spare = new Set(Array.isArray(b.spareIds) ? (b.spareIds as string[]) : typeof b.spare === "string" ? (b.spare as string).split(",") : []);
      let n = 0;
      for (const c of targets) {
        if (spare.has(c.id) || immortals.has(c.id)) continue;
        adminKill(S(), engine.clock.tick, engine.clock.day, c.id, "mass extinction");
        n++;
      }
      emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner unleashed MASS EXTINCTION: ${n} perished`, [], { kind: "mass-extinction", n });
      audit(req, "world.mass_extinction", `${n} citizens`, { population: targets.length }, { killed: n }, String(b.reason ?? ""));
      res.json({ ok: true, killed: n });
    } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
  });
  app.post("/api/admin/miracle", requirePerm("citizen.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const kind = String(b.kind ?? "blessing");
    let n = 0;
    for (const c of Object.values(S().citizens)) {
      if (!c.alive) continue;
      if (kind === "heal-all" || kind === "blessing" || kind === "miracle") { c.needs.health = 100; c.needs.happiness = Math.min(100, c.needs.happiness + 20); n++; }
      if (kind === "wealth" || kind === "blessing") { c.financial.cash += 1000; ledger(c.id, "ADMIN_MINT", 1000, c.financial.cash, "miracle", req.admin!.id); }
      if (kind === "revive-all" || kind === "miracle") { if (!c.alive) continue; }
    }
    if (kind === "revive-all" || kind === "miracle") {
      for (const c of Object.values(S().citizens)) if (!c.alive && !immortals.has(c.id)) { adminRevive(S(), engine.clock.tick, engine.clock.day, c.id); n++; }
    }
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner performed miracle (${kind}): ${n} touched`, [], { kind, n });
    audit(req, "world.miracle", kind, null, { n }, String(b.reason ?? ""));
    res.json({ ok: true, kind, touched: n });
  });
  app.post("/api/admin/money-drop", requirePerm("economy.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const amount = Math.min(100000, Math.max(1, Number(b.amount ?? 1000)));
    const targets = filterCitizens(S(), { ...((b.filter as Record<string, unknown>) ?? {}), alive: true, limit: Number(b.count ?? 20) });
    for (const c of targets) { c.financial.cash += amount; ledger(c.id, "ADMIN_MINT", amount, c.financial.cash, "money-drop", req.admin!.id); }
    emitEvent(S(), engine.clock.tick, engine.clock.day, "MoneyTransferred", `Owner money-drop: ${amount} to ${targets.length} citizens (ADMIN_MINT)`, targets.map((c) => c.id), { kind: "ADMIN_MINT", amount });
    audit(req, "economy.money_drop", `${targets.length} citizens`, null, { amount, count: targets.length }, String(b.reason ?? ""));
    res.json({ ok: true, amount, count: targets.length, ids: targets.map((c) => c.id) });
  });
  app.post("/api/admin/nuke-economy", requirePerm("economy.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    autoSnapshot(deps, req.admin!.id, "nuke-economy");
    const factor = Math.max(0, Math.min(1, Number(b.factor ?? 0.1)));
    for (const c of Object.values(S().citizens)) { c.financial.cash = Math.round(c.financial.cash * factor); c.financial.bank = Math.round(c.financial.bank * factor); }
    for (const bd of Object.values(S().buildings)) bd.economic.funds = Math.round(bd.economic.funds * factor);
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner NUKED the economy (x${factor})`, [], { kind: "nuke", factor });
    audit(req, "economy.nuke", "all wallets", null, { factor }, String(b.reason ?? ""));
    res.json({ ok: true, factor });
  });
  app.post("/api/admin/chaos", requirePerm("events.spawn"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const kind = String(b.kind ?? (Math.random() < 0.5 ? "chaos" : "blessing"));
    const alive = Object.values(S().citizens).filter((c) => c.alive);
    const pick = alive[Math.floor(Math.random() * Math.max(1, alive.length))];
    if (kind === "chaos" && pick) {
      const roll = Math.random();
      if (roll < 0.3 && !immortals.has(pick.id)) adminKill(S(), engine.clock.tick, engine.clock.day, pick.id, "random chaos");
      else if (roll < 0.6) { pick.financial.cash = 0; pick.financial.bank = 0; ledger(pick.id, "ADMIN_REMOVE", 0, 0, "random chaos", req.admin!.id); }
      else { pick.needs.health = Math.max(5, pick.needs.health - 40); }
    } else if (pick) {
      pick.financial.cash += 5000; ledger(pick.id, "ADMIN_MINT", 5000, pick.financial.cash, "random blessing", req.admin!.id);
      pick.needs.health = 100; pick.needs.happiness = 100;
    }
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner unleashed random ${kind}${pick ? ` on ${pick.firstName}` : ""}`, pick ? [pick.id] : [], { kind });
    audit(req, "world.chaos", kind, null, { target: pick?.id ?? null }, String(b.reason ?? ""));
    res.json({ ok: true, kind, target: pick ? { id: pick.id, name: `${pick.firstName} ${pick.lastName}` } : null });
  });
  app.post("/api/admin/pick", requirePerm("world.read"), (req, res) => {
    const kind = String((req.body as { kind?: string }).kind ?? "victim");
    const alive = Object.values(S().citizens).filter((c) => c.alive);
    if (alive.length === 0) { res.status(400).json({ error: "no living citizens" }); return; }
    let c = alive[Math.floor(Math.random() * alive.length)];
    if (kind === "champion") c = [...alive].sort((a, b) => (b.financial.cash + b.financial.bank) - (a.financial.cash + a.financial.bank))[0] ?? c;
    res.json({ ok: true, kind, pick: { id: c.id, name: `${c.firstName} ${c.lastName}`, wealth: c.financial.cash + c.financial.bank, health: c.needs.health } });
  });
  app.post("/api/admin/possess", requirePerm("ai.control"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id = resolveId(S(), String(b.citizenId ?? b.id ?? ""));
    if (!id || !S().citizens[id]) { res.status(404).json({ error: "citizen not found" }); return; }
    if (b.release || b.action === "release") {
      possessed.delete(id);
      S().memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.6, text: "[ADMIN] Possession ended — autonomy restored cleanly.", tags: ["admin", "possess-end"] });
      audit(req, "ai.possess_end", id, { possessed: true }, { possessed: false }, String(b.reason ?? ""));
      res.json({ ok: true, id, possessed: false }); return;
    }
    possessed.add(id);
    if (typeof b.activity === "string") S().citizens[id].currentActivity = b.activity as never;
    if (typeof b.text === "string" && b.text) S().memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.9, text: `[ADMIN POSSESSION] Manual act: ${String(b.text).slice(0, 280)} (autonomy paused)`, tags: ["admin", "possess"] });
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner possessed ${S().citizens[id].firstName} (autonomy paused)`, [id], { kind: "possess" });
    audit(req, "ai.possess", id, { possessed: false }, { possessed: true }, String(b.reason ?? ""));
    res.json({ ok: true, id, possessed: true });
  });

  // ----- businesses -----
  app.get("/api/admin/businesses", requirePerm("world.read"), (_req, res) => {
    res.json(Object.values(S().buildings).map((b) => ({ id: b.id, name: b.name, type: b.type, funds: b.economic.funds, priceLevel: b.economic.priceLevel, wagesOwed: b.economic.wagesOwed, ownerId: b.ownerId, workers: b.workers, inventory: b.inventory, x: b.position.x, y: b.position.y })));
  });
  app.post("/api/admin/businesses/:id/admin", requirePerm("business.modify"), (req, res) => {
    try {
      const bd = S().buildings[req.params.id]; if (!bd) { res.status(404).json({ error: "not found" }); return; }
      const before = JSON.parse(JSON.stringify(bd.economic));
      const b = (req.body ?? {}) as Record<string, unknown>;
      if (typeof b.funds === "number") bd.economic.funds = Math.max(0, Math.round(b.funds as number));
      if (typeof b.priceLevel === "number") bd.economic.priceLevel = Math.max(0.1, Math.min(10, Number(b.priceLevel)));
      if (typeof b.ownerId === "string") bd.ownerId = (b.ownerId as string) || null;
      if (typeof b.name === "string") bd.name = (b.name as string).slice(0, 80);
      audit(req, "business.admin", bd.id, before, { ...bd.economic }, String(b.reason ?? ""));
      res.json({ ok: true, building: bd });
    } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
  });
  app.post("/api/admin/businesses/spawner", requirePerm("business.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id = uid("b_god");
    S().buildings[id] = {
      id, name: String(b.name ?? "God Shop"), type: (b.type as never) ?? "shop",
      position: { x: Number(b.x ?? 500), y: Number(b.y ?? 500) }, capacity: Number(b.capacity ?? 10),
      ownerId: (b.ownerId as string) ?? null, workers: [], inventory: (b.inventory as Record<string, number>) ?? { goods: 50, meal: 50 },
      openingHours: { open: 6, close: 22 }, economic: { funds: Number(b.funds ?? 2000), priceLevel: 1, wagesOwed: 0 },
    };
    emitEvent(S(), engine.clock.tick, engine.clock.day, "BusinessCreated", `Owner created business ${S().buildings[id].name}`, [], { admin: true }, id);
    audit(req, "business.spawn", id, null, { name: S().buildings[id].name }, String(b.reason ?? ""));
    res.json({ ok: true, id });
  });
  app.post("/api/admin/businesses/tycoon", requirePerm("business.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id = resolveId(S(), String(b.citizenId ?? ""));
    if (!id) { res.status(404).json({ error: "citizen not found" }); return; }
    const bid = uid("b_god");
    S().buildings[bid] = {
      id: bid, name: `${S().citizens[id].firstName} Enterprises`, type: "shop",
      position: { ...S().citizens[id].position }, capacity: 20, ownerId: id, workers: [id],
      inventory: { goods: 200, meal: 100 }, openingHours: { open: 0, close: 24 },
      economic: { funds: 50000, priceLevel: 1, wagesOwed: 0 },
    };
    S().citizens[id].financial.cash += 10000; ledger(id, "ADMIN_MINT", 10000, S().citizens[id].financial.cash, "tycoon", req.admin!.id);
    emitEvent(S(), engine.clock.tick, engine.clock.day, "BusinessCreated", `Owner made ${S().citizens[id].firstName} a TYCOON`, [id], {}, bid);
    audit(req, "business.tycoon", id, null, { buildingId: bid }, String(b.reason ?? ""));
    res.json({ ok: true, citizenId: id, buildingId: bid });
  });

  // ----- economy / effects -----
  app.get("/api/admin/economy", requirePerm("world.read"), (_req, res) => {
    res.json({ treasury: S().government.treasury, taxRate: S().government.taxRate, moneySupply: totalMoney(S()), effects: (S() as WorldState & { adminEffects?: unknown }).adminEffects ?? [] });
  });
  app.post("/api/admin/economy", requirePerm("economy.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const before = { treasury: S().government.treasury, taxRate: S().government.taxRate };
    if (typeof b.treasury === "number") S().government.treasury = Math.round(b.treasury as number);
    if (typeof b.taxRate === "number") S().government.taxRate = Math.max(0, Math.min(1, Number(b.taxRate)));
    if (typeof b.treasuryDelta === "number") S().government.treasury += Math.round(b.treasuryDelta as number);
    audit(req, "economy.intervention", "treasury", before, { treasury: S().government.treasury, taxRate: S().government.taxRate }, String(b.reason ?? ""));
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner intervened in economy: treasury=${S().government.treasury} tax=${S().government.taxRate}`, [], { kind: "economy" });
    res.json({ ok: true, treasury: S().government.treasury, taxRate: S().government.taxRate, moneySupply: totalMoney(S()) });
  });
  app.post("/api/admin/effects", requirePerm("economy.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const st = S() as WorldState & { adminEffects?: Array<Record<string, unknown>> };
    st.adminEffects = st.adminEffects ?? [];
    const eff = { id: uid("fx"), ts: Date.now(), scope: String(b.scope ?? "citywide"), kind: String(b.kind ?? "multiplier"), multiplier: Number(b.multiplier ?? 1), label: String(b.label ?? "admin effect"), actor: req.admin!.id };
    st.adminEffects.push(eff);
    if (eff.scope === "citywide" && typeof eff.multiplier === "number" && eff.multiplier !== 1 && (eff.kind === "wages" || eff.kind === "prices")) {
      for (const bd of Object.values(S().buildings)) {
        if (eff.kind === "prices") bd.economic.priceLevel = Math.max(0.1, Math.min(10, bd.economic.priceLevel * eff.multiplier));
        if (eff.kind === "wages") bd.economic.funds = Math.max(0, Math.round(bd.economic.funds * eff.multiplier));
      }
    }
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner set citywide effect ${eff.kind} x${eff.multiplier}`, [], eff as unknown as Record<string, unknown>);
    audit(req, "economy.effect", eff.id, null, eff, String(b.reason ?? ""));
    res.json({ ok: true, effect: eff });
  });

  // ----- government -----
  app.get("/api/admin/government", requirePerm("world.read"), (_req, res) => {
    const g = S().government;
    res.json({ ...g, mayorName: g.mayorId && S().citizens[g.mayorId] ? `${S().citizens[g.mayorId].firstName} ${S().citizens[g.mayorId].lastName}` : null });
  });
  const govSet = (req: Request, res: Response): void => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const before = { ...S().government };
    if (typeof b.taxRate === "number") S().government.taxRate = Math.max(0, Math.min(1, Number(b.taxRate)));
    if (typeof b.treasury === "number") S().government.treasury = Math.round(Number(b.treasury));
    if (typeof b.mayorId === "string") {
      const mid = resolveId(S(), b.mayorId as string);
      if (!mid) { res.status(400).json({ error: "mayor citizen not found" }); return; }
      S().government.mayorId = mid;
    }
    const mayorNow: string | null = S().government.mayorId;
    audit(req, "government.modify", "government", before, { ...S().government }, String(b.reason ?? ""));
    emitEvent(S(), engine.clock.tick, engine.clock.day, "LawChanged", `Owner reshaped government: tax=${S().government.taxRate} treasury=${S().government.treasury}`, mayorNow ? [mayorNow] : [], { admin: true });
    res.json({ ok: true, government: S().government });
  };
  app.post("/api/admin/government", requirePerm("government.modify"), govSet);
  app.post("/api/admin/government/tax", requirePerm("government.modify"), govSet);
  app.post("/api/admin/government/law", requirePerm("government.modify"), (req, res) => {
    const text = String((req.body as { text?: string }).text ?? "");
    if (!text) { res.status(400).json({ error: "text required" }); return; }
    emitEvent(S(), engine.clock.tick, engine.clock.day, "LawChanged", `Owner decreed law: ${text}`, [], { admin: true });
    audit(req, "government.law", text.slice(0, 80), null, { text }, String((req.body as { reason?: string }).reason ?? ""));
    res.json({ ok: true });
  });
  app.post("/api/admin/government/election", requirePerm("government.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const winner = typeof b.forceWinner === "string" ? resolveId(S(), b.forceWinner as string) : null;
    const alive = Object.values(S().citizens).filter((c) => c.alive);
    const randId: string | null = alive.length > 0 ? alive[Math.floor(Math.random() * alive.length)].id : null;
    const pick: string | null = winner ?? randId;
    emitEvent(S(), engine.clock.tick, engine.clock.day, "ElectionStarted", `Owner called a snap election`, [], { admin: true });
    if (pick) {
      S().government.mayorId = pick;
      emitEvent(S(), engine.clock.tick, engine.clock.day, "ElectionWon", `Owner election: ${S().citizens[pick].firstName} ${S().citizens[pick].lastName} won`, [pick], { forced: Boolean(winner) });
    }
    audit(req, "government.election", pick ?? "none", null, { winner: pick }, String(b.reason ?? ""));
    res.json({ ok: true, winner: pick });
  });

  // ----- crime -----
  app.post("/api/admin/crime/arrest", requirePerm("world.modify"), (req, res) => {
    const id = resolveId(S(), String((req.body as { citizenId?: string }).citizenId ?? ""));
    if (!id) { res.status(404).json({ error: "citizen not found" }); return; }
    const c = S().citizens[id];
    if (c.jobId && S().jobs[c.jobId]) S().jobs[c.jobId].workerId = null;
    c.jobId = null; c.destinationBuildingId = "b_police"; c.position = { ...S().buildings["b_police"].position };
    emitEvent(S(), engine.clock.tick, engine.clock.day, "Arrested", `Owner had ${c.firstName} arrested`, [id], { admin: true });
    audit(req, "crime.arrest", id, null, { jailed: true }, String((req.body as { reason?: string }).reason ?? ""));
    res.json({ ok: true, id });
  });
  app.post("/api/admin/crime/release", requirePerm("world.modify"), (req, res) => {
    const id = resolveId(S(), String((req.body as { citizenId?: string }).citizenId ?? ""));
    if (!id) { res.status(404).json({ error: "citizen not found" }); return; }
    S().citizens[id].destinationBuildingId = null;
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner released ${S().citizens[id].firstName} from custody`, [id], { kind: "release" });
    audit(req, "crime.release", id, null, { jailed: false }, String((req.body as { reason?: string }).reason ?? ""));
    res.json({ ok: true, id });
  });

  // ----- rumour / secret / event spawner -----
  app.post("/api/admin/rumour", requirePerm("events.spawn"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const text = String(b.text ?? ""); if (!text) { res.status(400).json({ error: "text required" }); return; }
    const targets = filterCitizens(S(), { ...(b.filter as Record<string, unknown> ?? {}), alive: true, limit: Number(b.count ?? 5) });
    for (const c of targets) S().memories.push({ id: uid("m"), citizenId: c.id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.7, text: `[RUMOUR — ADMIN] ${text}`, tags: ["admin", "rumour"] });
    emitEvent(S(), engine.clock.tick, engine.clock.day, "GodIntervention", `Owner seeded rumour: "${text.slice(0, 120)}" (${targets.length} hearers)`, targets.map((c) => c.id), { kind: "rumour", text });
    audit(req, "events.rumour", text.slice(0, 80), null, { hearers: targets.length }, String(b.reason ?? ""));
    res.json({ ok: true, hearers: targets.length });
  });
  app.post("/api/admin/secret-gen", requirePerm("events.spawn"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const alive = Object.values(S().citizens).filter((c) => c.alive);
    if (alive.length < 2) { res.status(400).json({ error: "need 2+ living citizens" }); return; }
    const holder = alive[Math.floor(Math.random() * alive.length)];
    let about = alive[Math.floor(Math.random() * alive.length)];
    if (about.id === holder.id) about = alive[(alive.indexOf(holder) + 1) % alive.length];
    const templates = [
      `${holder.firstName} saw ${about.firstName} meeting a stranger at midnight`,
      `${holder.firstName} knows ${about.firstName} hides money under their mattress`,
      `${holder.firstName} suspects ${about.firstName} of forging clinic records`,
      `${holder.firstName} heard ${about.firstName} plans to run for mayor`,
    ];
    const text = String(b.text ?? templates[Math.floor(Math.random() * templates.length)]);
    const sid = uid("s");
    try { db.prepare("INSERT OR REPLACE INTO secret(id,holder_id,about_id,text,known_to,tick) VALUES(?,?,?,?,?,?)").run(sid, holder.id, about.id, text, JSON.stringify([]), engine.clock.tick); } catch { /* ignore */ }
    S().memories.push({ id: uid("m"), citizenId: holder.id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.95, text: `[ADMIN SECRET] ${text}`, tags: ["admin", "secret"] });
    audit(req, "events.secret", sid, null, { holder: holder.id, about: about.id }, String(b.reason ?? ""));
    res.json({ ok: true, secretId: sid, holder: holder.id, about: about.id, text });
  });
  app.post("/api/admin/event-spawn", requirePerm("events.spawn"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const summary = String(b.summary ?? b.text ?? "Owner-caused event");
    const type = String(b.type ?? "GodIntervention");
    const actorIds = Array.isArray(b.actorIds) ? (b.actorIds as string[]).filter((x) => S().citizens[x]) : [];
    emitEvent(S(), engine.clock.tick, engine.clock.day, type, summary, actorIds, { ...(b.data as Record<string, unknown> ?? {}) });
    audit(req, "events.spawn", type, null, { summary }, String(b.reason ?? ""));
    res.json({ ok: true, type, summary });
  });

  // ----- snapshots -----
  app.get("/api/admin/snapshots", requirePerm("world.read"), (_req, res) => { res.json([...snapshotMeta(), ...listSlots().filter((s) => s.startsWith("god_")).map((s) => ({ name: s, slot: true }))]); });
  app.post("/api/admin/snapshots", requirePerm("world.modify"), (req, res) => {
    const name = String((req.body as { name?: string }).name ?? `snap_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const data = engine.save();
    try { db.prepare("INSERT OR REPLACE INTO admin_snapshots(name,ts,tick,reason,actor,size,data) VALUES(?,?,?,?,?,?,?)").run(name, Date.now(), engine.clock.tick, String((req.body as { reason?: string }).reason ?? "manual"), req.admin!.id, data.length, data); } catch (e) { res.status(500).json({ error: String(e) }); return; }
    try { saveSlot(`god_${name}`, data); } catch { /* ignore */ }
    audit(req, "snapshot.create", name, null, { tick: engine.clock.tick, size: data.length }, "");
    res.json({ ok: true, name, tick: engine.clock.tick, size: data.length });
  });
  app.post("/api/admin/snapshots/:name/restore", requirePerm("world.modify"), (req, res) => {
    const name = req.params.name;
    let data: string | null = null;
    try { const r = db.prepare("SELECT data FROM admin_snapshots WHERE name=?").get(name) as { data: string } | undefined; data = r?.data ?? null; } catch { /* ignore */ }
    if (!data) data = loadSlot(name) ?? loadSlot(`god_${name}`);
    if (!data) { res.status(404).json({ error: "snapshot not found" }); return; }
    const before = engine.snapshot();
    engine.load(data);
    audit(req, "snapshot.restore", name, before, engine.snapshot(), String((req.body as { reason?: string }).reason ?? ""));
    res.json({ ok: true, name, snapshot: engine.snapshot() });
  });
  app.delete("/api/admin/snapshots/:name", requirePerm("world.modify"), (req, res) => {
    try { db.prepare("DELETE FROM admin_snapshots WHERE name=?").run(req.params.name); } catch { /* ignore */ }
    audit(req, "snapshot.delete", req.params.name, null, null, "");
    res.json({ ok: true });
  });
  app.post("/api/admin/snapshots/:name/duplicate", requirePerm("world.modify"), (req, res) => {
    const src = req.params.name;
    let data: string | null = null;
    try { const r = db.prepare("SELECT data,reason FROM admin_snapshots WHERE name=?").get(src) as { data: string; reason: string } | undefined; data = r?.data ?? null; } catch { /* ignore */ }
    if (!data) { res.status(404).json({ error: "snapshot not found" }); return; }
    const name = `${src}_copy_${Date.now().toString(36)}`;
    try { db.prepare("INSERT OR REPLACE INTO admin_snapshots(name,ts,tick,reason,actor,size,data) VALUES(?,?,?,?,?,?,?)").run(name, Date.now(), engine.clock.tick, `copy of ${src}`, req.admin!.id, data.length, data); } catch { /* ignore */ }
    audit(req, "snapshot.duplicate", name, { src }, null, "");
    res.json({ ok: true, name });
  });

  // ----- time -----
  app.post("/api/admin/time", requirePerm("world.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.paused === "boolean") engine.paused = b.paused as boolean;
    if (typeof b.speed === "number") engine.speed = Math.min(100, Math.max(0, Number(b.speed)));
    audit(req, "time.set", "clock", null, { paused: engine.paused, speed: engine.speed }, "");
    res.json({ ok: true, paused: engine.paused, speed: engine.speed, tick: engine.clock.tick, day: engine.clock.day });
  });
  app.post("/api/admin/time/step", requirePerm("world.modify"), (req, res) => {
    const n = Math.min(5000, Math.max(1, Number((req.body as { n?: number }).n ?? 1)));
    const was = engine.paused; engine.paused = false;
    for (let i = 0; i < n; i++) engine.tick();
    deps.afterTicks(n);
    engine.paused = was;
    res.json({ ok: true, stepped: n, tick: engine.clock.tick, day: engine.clock.day });
  });
  app.post("/api/admin/time/run-until", requirePerm("world.modify"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const cap = Math.min(100000, Math.max(1, Number(b.maxTicks ?? 20000)));
    const targetDay = typeof b.day === "number" ? Number(b.day) : null;
    const targetTick = typeof b.tick === "number" ? Number(b.tick) : null;
    const popBelow = typeof b.popBelow === "number" ? Number(b.popBelow) : null;
    const was = engine.paused; engine.paused = false;
    let i = 0;
    for (; i < cap; i++) {
      engine.tick();
      if (targetDay !== null && engine.clock.day >= targetDay) { i++; break; }
      if (targetTick !== null && engine.clock.tick >= targetTick) { i++; break; }
      if (popBelow !== null && Object.values(S().citizens).filter((c) => c.alive).length <= popBelow) { i++; break; }
    }
    deps.afterTicks(i);
    engine.paused = was;
    audit(req, "time.run_until", "clock", null, { ticks: i, day: engine.clock.day }, String(b.reason ?? ""));
    res.json({ ok: true, ticks: i, tick: engine.clock.tick, day: engine.clock.day, capped: i >= cap });
  });

  // ----- verify / database / system -----
  app.get("/api/admin/invariant-check", requirePerm("world.read"), (_req, res) => { res.json({ checks: verifyWorld(S()), moneySupply: totalMoney(S()) }); });
  app.post("/api/admin/verify-world", requirePerm("system.debug"), (_req, res) => { res.json({ checks: verifyWorld(S()), moneySupply: totalMoney(S()), tick: engine.clock.tick }); });
  app.get("/api/admin/database", requirePerm("system.database"), (_req, res) => {
    let tables: unknown[] = [];
    try { tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(); } catch { /* ignore */ }
    res.json({ tables, slots: listSlots(), snapshots: snapshotMeta().length, audit: auditLog.length });
  });
  app.get("/api/admin/system", requirePerm("system.debug"), (_req, res) => {
    res.json({
      tick: engine.clock.tick, day: engine.clock.day, hour: engine.clock.hour,
      paused: engine.paused, speed: engine.speed,
      citizens: Object.keys(S().citizens).length,
      alive: Object.values(S().citizens).filter((c) => c.alive).length,
      events: S().events.length, posts: S().posts.length,
      moneySupply: totalMoney(S()),
      aiPaused: !deps.aiConfig.backgroundEnabled,
      queue: deps.scheduler ? (deps.scheduler.queue as unknown[]).length : 0,
      possessed: [...possessed], immortals: [...immortals],
    });
  });

  // ----- AI -----
  app.post("/api/admin/ai/pause", requirePerm("ai.control"), (req, res) => {
    deps.aiConfig.backgroundEnabled = false;
    audit(req, "ai.pause", "brain", null, { paused: true }, "");
    res.json({ ok: true, paused: true });
  });
  app.post("/api/admin/ai/resume", requirePerm("ai.control"), (req, res) => {
    deps.aiConfig.backgroundEnabled = true;
    audit(req, "ai.resume", "brain", null, { paused: false }, "");
    res.json({ ok: true, paused: false });
  });
  app.post("/api/admin/ai/force-think", requirePerm("ai.control"), (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id = resolveId(S(), String(b.citizenId ?? b.id ?? ""));
    if (!id) { res.status(404).json({ error: "citizen not found" }); return; }
    let enqueued: string | null = null;
    try { enqueued = deps.enqueueFor ? deps.enqueueFor(id, "social" as never, "social" as never, "admin force-think") : null; } catch { enqueued = null; }
    S().memories.push({ id: uid("m"), citizenId: id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.8, text: `[ADMIN FORCE-THOUGHT] The Owner commands deep reflection: ${String(b.prompt ?? "think hard about your life").slice(0, 200)}`, tags: ["admin", "force-think"] });
    audit(req, "ai.force_think", id, null, { enqueued }, String(b.prompt ?? ""));
    res.json({ ok: true, id, enqueued });
  });

  // ----- command bar -----
  app.post("/api/admin/command", requirePerm("world.read"), (req, res) => {
    const text = String((req.body as { text?: string }).text ?? "");
    const parsed = parseAdminCommand(text);
    if (parsed.rejected) { res.json({ ok: false, ...parsed }); return; }
    const role = req.admin!.role;
    const needs: Record<string, Permission> = {
      "citizen.money": "economy.modify", "citizen.kill": "citizen.kill", "citizen.revive": "citizen.modify",
      "citizen.heal": "citizen.modify", "citizen.teleport": "citizen.modify", "citizens.spawn": "citizen.spawn",
      "world.extinction": "citizen.kill", "world.miracle": "citizen.modify", "economy.money_drop": "economy.modify",
      "economy.nuke": "economy.modify", "economy.boom": "economy.modify", "economy.recession": "economy.modify",
      "world.chaos": "events.spawn", "ai.pause": "ai.control", "ai.resume": "ai.control",
      "time.step": "world.modify", "time.speed": "world.modify", "time.pause": "world.modify",
      "government.mayor": "government.modify", "government.tax": "government.modify", "government.election": "government.modify",
      "crime.arrest": "world.modify", "events.spawn": "events.spawn", "events.rumour": "events.spawn",
      "ai.force_think": "ai.control", "citizen.clone": "citizen.spawn", "citizen.immortal": "citizen.modify",
    };
    const denied = parsed.actions.filter((a) => !hasPermission(role, needs[a.type] ?? "world.modify"));
    if (denied.length > 0) { res.status(403).json({ ok: false, error: `forbidden for role ${role}: ${denied.map((d) => d.type).join(",")}`, parsed }); return; }
    audit(req, "command.parse", text.slice(0, 120), null, { actions: parsed.actions.map((a) => a.type) }, text);
    res.json({ ok: true, ...parsed, hint: "dry-run parse only — execute via specific endpoints" });
  });

  // ----- audit -----
  app.get("/api/admin/audit", requirePerm("world.read"), (req, res) => {
    const limit = Math.min(500, Number(req.query.limit ?? 100));
    let persisted: Array<Record<string, unknown>> = [];
    try { persisted = db.prepare("SELECT * FROM admin_audit ORDER BY ts DESC LIMIT ?").all(limit) as Array<Record<string, unknown>>; } catch { /* ignore */ }
    res.json({ live: auditLog.slice(-limit).reverse(), persisted: persisted.slice(0, limit) });
  });
  app.get("/api/admin/audit/export", requirePerm("world.read"), (req, res) => {
    const fmt = String(req.query.format ?? "json");
    if (fmt === "csv") {
      const rows = ["id,ts,actor,role,action,target,reason,reversible", ...auditLog.map((a) => [a.id, a.ts, a.actor, a.role, a.action, `"${a.target}"`, `"${a.reason.replace(/"/g, "'")}"`, a.reversible].join(","))];
      res.type("text/csv").send(rows.join("\n")); return;
    }
    res.json(auditLog);
  });

  // ----- experiment mode flag + hall of fame -----
  app.get("/api/admin/hall", requirePerm("world.read"), (_req, res) => {
    const alive = Object.values(S().citizens).filter((c) => c.alive);
    const byWealth = [...alive].sort((a, b) => (b.financial.cash + b.financial.bank) - (a.financial.cash + a.financial.bank)).slice(0, 5)
      .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, wealth: c.financial.cash + c.financial.bank }));
    const fame = [...alive].sort((a, b) => b.needs.happiness - a.needs.happiness).slice(0, 5)
      .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, happiness: Math.round(c.needs.happiness) }));
    const infamy = S().events.filter((e) => e.type === "CrimeCommitted" || e.type === "Arrested").slice(-10).reverse();
    res.json({ fame: byWealth, happiness: fame, infamy });
  });
}
