// db.ts: better-sqlite3 persistence — worlds, citizens, buildings, events, metrics, posts.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/echo.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

export function migrate(): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS saves (slot TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, type TEXT, tick INTEGER, day INTEGER, summary TEXT, actor TEXT, data TEXT);
  CREATE TABLE IF NOT EXISTS metrics (day INTEGER PRIMARY KEY, population INTEGER, wealth REAL, businesses INTEGER, happiness REAL, health REAL, employment REAL, supply REAL);
  CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, author TEXT, text TEXT, tick INTEGER, day INTEGER, likes INTEGER);
  CREATE TABLE IF NOT EXISTS cognition_results (id TEXT PRIMARY KEY, citizen_id TEXT, type TEXT, decision TEXT, reason TEXT, result TEXT, model TEXT, latency_ms INTEGER, at INTEGER);
  CREATE TABLE IF NOT EXISTS citizen_mind (citizen_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS memory (id TEXT PRIMARY KEY, citizen_id TEXT, kind TEXT, text TEXT, tags TEXT, entities TEXT, importance REAL, tick INTEGER);
  CREATE TABLE IF NOT EXISTS belief (id INTEGER PRIMARY KEY AUTOINCREMENT, citizen_id TEXT, subject TEXT, claim TEXT, confidence REAL, source TEXT, provenance TEXT, tick INTEGER);
  CREATE TABLE IF NOT EXISTS secret (id TEXT PRIMARY KEY, holder_id TEXT, about_id TEXT, text TEXT, known_to TEXT, tick INTEGER);
  CREATE TABLE IF NOT EXISTS thought_summary (id TEXT PRIMARY KEY, citizen_id TEXT, summary TEXT, tick INTEGER);
  CREATE TABLE IF NOT EXISTS model_config (role TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS benchmark (id TEXT PRIMARY KEY, model TEXT, task TEXT, score REAL, latency_ms INTEGER, at INTEGER);
  CREATE TABLE IF NOT EXISTS brain_metric (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value REAL, at INTEGER);
  CREATE TABLE IF NOT EXISTS prompt_version (name TEXT PRIMARY KEY, version TEXT, template TEXT, updated_at INTEGER);
  `);
}
migrate();

export function saveSlot(slot: string, data: string): void {
  db.prepare("INSERT INTO saves(slot,data,updated_at) VALUES(?,?,?) ON CONFLICT(slot) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").run(slot, data, Date.now());
}
export function loadSlot(slot: string): string | null {
  const r = db.prepare("SELECT data FROM saves WHERE slot=?").get(slot) as { data: string } | undefined;
  return r?.data ?? null;
}
export function listSlots(): string[] {
  return (db.prepare("SELECT slot FROM saves").all() as Array<{ slot: string }>).map((r) => r.slot);
}

// ---- ECHO BRAIN persistence ----
export function logThought(t: { id: string; citizenId: string; type: string; decision: string; reason: string; result: string; model: string; latencyMs: number }): void {
  db.prepare("INSERT OR REPLACE INTO cognition_results(id,citizen_id,type,decision,reason,result,model,latency_ms,at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(t.id, t.citizenId, t.type, t.decision, t.reason.slice(0, 400), t.result, t.model, t.latencyMs, Date.now());
}
export function getThoughtFeed(limit = 50): Array<Record<string, unknown>> {
  return db.prepare("SELECT * FROM cognition_results ORDER BY at DESC LIMIT ?").all(limit) as Array<Record<string, unknown>>;
}
export function saveMind(citizenId: string, data: string): void {
  db.prepare("INSERT INTO citizen_mind(citizen_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(citizen_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").run(citizenId, data, Date.now());
}
export function loadMind(citizenId: string): string | null {
  const r = db.prepare("SELECT data FROM citizen_mind WHERE citizen_id=?").get(citizenId) as { data: string } | undefined;
  return r?.data ?? null;
}
export function saveRoleConfig(role: string, data: string): void {
  db.prepare("INSERT INTO model_config(role,data) VALUES(?,?) ON CONFLICT(role) DO UPDATE SET data=excluded.data").run(role, data);
}
export function loadAllRoleConfigs(): Array<{ role: string; data: string }> {
  return db.prepare("SELECT role, data FROM model_config").all() as Array<{ role: string; data: string }>;
}
export function logBenchmark(b: { id: string; model: string; task: string; score: number; latencyMs: number }): void {
  db.prepare("INSERT INTO benchmark(id,model,task,score,latency_ms,at) VALUES(?,?,?,?,?,?)").run(b.id, b.model, b.task, b.score, b.latencyMs, Date.now());
}
export function listBenchmarks(): Array<Record<string, unknown>> {
  return db.prepare("SELECT * FROM benchmark ORDER BY at DESC LIMIT 200").all() as Array<Record<string, unknown>>;
}
export function recordMetric(name: string, value: number): void {
  db.prepare("INSERT INTO brain_metric(name,value,at) VALUES(?,?,?)").run(name, value, Date.now());
}
export function dbSizeBytes(): number {
  try {
    const r = db.prepare("SELECT page_count * page_size as sz FROM pragma_page_count(), pragma_page_size()").get() as { sz: number };
    return r.sz;
  } catch { return -1; }
}
