// roles.ts: role/model router pool. Hot-swappable via JSON file + API.
import fs from "node:fs";

export type ModelRole = "reflex" | "social" | "planning" | "business" | "government" | "dialogue" | "narrator" | "historian";
export const MODEL_ROLES: ModelRole[] = ["reflex", "social", "planning", "business", "government", "dialogue", "narrator", "historian"];

export interface RoleConfig {
  role: ModelRole;
  model: string;
  agent: string;
  timeoutMs: number;
  fallbackModels: string[];
  enabled: boolean;
}

const FREE = "opencode/space-bunny-free";
const FAST = "opencode/nemotron-3.5-lightning-free";
const PROSE = FREE;

export function defaultRoles(): RoleConfig[] {
  return [
    { role: "reflex", model: FREE, agent: "echo-reflex", timeoutMs: 30000, fallbackModels: [FAST], enabled: true },
    { role: "social", model: FREE, agent: "echo-social", timeoutMs: 60000, fallbackModels: [FAST], enabled: true },
    { role: "planning", model: FREE, agent: "echo-planner", timeoutMs: 90000, fallbackModels: [FAST], enabled: true },
    { role: "business", model: FREE, agent: "echo-business", timeoutMs: 60000, fallbackModels: [FAST], enabled: true },
    { role: "government", model: FREE, agent: "echo-politics", timeoutMs: 60000, fallbackModels: [FAST], enabled: true },
    { role: "dialogue", model: FREE, agent: "echo-dialogue", timeoutMs: 60000, fallbackModels: [FAST], enabled: true },
    { role: "narrator", model: PROSE, agent: "echo-narrator", timeoutMs: 60000, fallbackModels: [FREE], enabled: true },
    { role: "historian", model: PROSE, agent: "echo-historian", timeoutMs: 60000, fallbackModels: [FREE], enabled: true },
  ];
}

export class RoleRouter {
  private roles = new Map<ModelRole, RoleConfig>();
  filePath: string | null = null;
  constructor(initial: RoleConfig[] = defaultRoles()) {
    for (const r of initial) this.roles.set(r.role, { ...r });
  }
  get(role: ModelRole): RoleConfig {
    const r = this.roles.get(role);
    if (!r) throw new Error(`unknown role ${role}`);
    return r;
  }
  all(): RoleConfig[] { return [...this.roles.values()]; }
  set(role: ModelRole, patch: Partial<RoleConfig>): RoleConfig {
    const cur = this.get(role);
    const next = { ...cur, ...patch, role };
    this.roles.set(role, next);
    this.persist();
    return next;
  }
  loadFile(path: string): void {
    this.filePath = path;
    try {
      const raw = fs.readFileSync(path, "utf8");
      const arr = JSON.parse(raw) as RoleConfig[];
      for (const r of arr) if (MODEL_ROLES.includes(r.role)) this.roles.set(r.role, { ...r });
    } catch { /* missing/corrupt file -> keep defaults */ }
  }
  persist(): void {
    if (!this.filePath) return;
    try { fs.writeFileSync(this.filePath, JSON.stringify(this.all(), null, 2)); } catch { /* ignore */ }
  }
}
