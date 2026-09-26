// opencode.ts: OpenCode CLI as primary AI gateway. Non-interactive `opencode run`,
// JSONL (--format json) parsing, model discovery via `opencode models`.
// Never throws into the sim: failures return null + record lastError.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const cognitionCwd = fileURLToPath(new URL("../cognition-runner/", import.meta.url));

export interface RunOpts {
  model?: string;
  agent?: string;
  timeoutMs?: number;
  exePath?: string;
  serverUrl?: string;
  cwd?: string;
  /** Extra CLI flags tolerated by the installed version (appended verbatim). */
  extraArgs?: string[];
}

export interface RunResult {
  text: string;
  raw: string;
  exitCode: number;
  durationMs: number;
  model: string;
  agent: string | null;
  stderr: string;
  errorType: string | null;
  errorMessage: string | null;
}

/** Parse `opencode run --format json` JSONL: concat type:text parts, surface type:error. */
export function parseRunJsonl(stdout: string): { text: string; errorType: string | null; errorMessage: string | null } {
  let text = "";
  let errorType: string | null = null;
  let errorMessage: string | null = null;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const o = JSON.parse(t) as { type?: string; part?: { type?: string; text?: string }; error?: { type?: string; message?: string } };
      if (o.type === "text" && typeof o.part?.text === "string") text += o.part.text;
      else if (o.type === "error") {
        errorType = String(o.error?.type ?? "unknown");
        errorMessage = String(o.error?.message ?? "unknown error");
      } else if (o.type === "step" && o.part?.type === "text" && typeof o.part.text === "string") {
        text += o.part.text;
      }
    } catch { /* ignore malformed lines */ }
  }
  return { text: text.trim(), errorType, errorMessage };
}

function execRun(exe: string, args: string[], cwd: string | undefined, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = execFile(exe, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, cwd, windowsHide: true }, (err, stdout, stderr) => {
      let exitCode = 0;
      if (err) {
        const e = err as unknown as { code?: unknown; killed?: boolean };
        exitCode = typeof e.code === "number" ? e.code : 1;
      }
      resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), exitCode });
    });
    // opencode run waits on stdin when piped; close it — prompts travel via argv.
    try { child.stdin?.end(); } catch { /* ignore */ }
  });
}

export async function runOpencode(prompt: string, o: RunOpts = {}): Promise<RunResult> {
  const exe = o.exePath ?? process.env.OPENCODE_EXE ?? "opencode";
  const model = o.model ?? process.env.OPENCODE_MODEL ?? "opencode/space-bunny-free";
  const agent = o.agent ?? null;
  const timeoutMs = o.timeoutMs ?? Number(process.env.OPENCODE_TIMEOUT_MS ?? 60000);
  // Cognition runs in a tiny project whose OpenCode config denies all tools.
  // The model only needs fictional state supplied in the prompt.
  const cwd = o.cwd ?? process.env.OPENCODE_CWD ?? cognitionCwd;
  const t0 = Date.now();
  const buildArgs = (withAgent: boolean): string[] => {
    const a = ["run", "-m", model, "--format", "json"];
    if (o.serverUrl ?? process.env.OPENCODE_SERVER_URL) a.push("--server", String(o.serverUrl ?? process.env.OPENCODE_SERVER_URL));
    if (withAgent && agent) a.push("--agent", agent);
    if (o.extraArgs) a.push(...o.extraArgs);
    a.push(`Answer only from the fictional simulation data below. Do not use tools, inspect files, or run commands.\n${prompt}`);
    return a;
  };
  // OpenCode's free tier rejects custom agents with provider.auth 403. The
  // role-specific instructions are already in Echo's prompt envelope.
  const supportsAgent = Boolean(agent) && !model.endsWith("-free");
  let r = await execRun(exe, buildArgs(supportsAgent), cwd, timeoutMs);
  let parsed = parseRunJsonl(r.stdout);
  // Tolerate installs/tiers where --agent fails (unknown agent, free-tier
  // agent restriction, flag drift): retry once without it. Role instructions
  // already live in the envelope prompt, so nothing is lost.
  if (supportsAgent && (!parsed.text || parsed.errorType)) {
    r = await execRun(exe, buildArgs(false), cwd, timeoutMs);
    parsed = parseRunJsonl(r.stdout);
    if (parsed.text) return { text: parsed.text, raw: r.stdout, exitCode: r.exitCode, durationMs: Date.now() - t0, model, agent: null, stderr: r.stderr, errorType: parsed.errorType, errorMessage: parsed.errorMessage };
    // fall through with the agent-less result (may still be an error)
    return { text: parsed.text, raw: r.stdout, exitCode: r.exitCode, durationMs: Date.now() - t0, model, agent: null, stderr: r.stderr, errorType: parsed.errorType, errorMessage: parsed.errorMessage };
  }
  return { text: parsed.text, raw: r.stdout, exitCode: r.exitCode, durationMs: Date.now() - t0, model, agent: supportsAgent ? agent : null, stderr: r.stderr, errorType: parsed.errorType, errorMessage: parsed.errorMessage };
}

/** Model discovery: parse `opencode models` (one `provider/model` per line). Cached. */
export class ModelDiscovery {
  private cache: string[] | null = null;
  private cachedAt = 0;
  constructor(private ttlMs = 10 * 60 * 1000) {}
  async list(exePath?: string, serverUrl?: string, refresh = false): Promise<string[]> {
    if (this.cache && !refresh && Date.now() - this.cachedAt < this.ttlMs) return this.cache;
    const exe = exePath ?? process.env.OPENCODE_EXE ?? "opencode";
    const args = ["models"];
    if (serverUrl ?? process.env.OPENCODE_SERVER_URL) args.push("--server", String(serverUrl ?? process.env.OPENCODE_SERVER_URL));
    const r = await execRun(exe, args, undefined, 30000);
    const models = r.stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && /^[\w.-]+\/[\w.:#@-]+/.test(l));
    if (models.length > 0) { this.cache = models; this.cachedAt = Date.now(); }
    return models.length > 0 ? models : (this.cache ?? []);
  }
  invalidate(): void { this.cache = null; }
}

export interface CognitionProviderOpts {
  exePath?: string;
  serverUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
  maxConcurrent?: number;
  enabled?: boolean;
  cwd?: string;
}

/** OpenCodeCognitionProvider: concurrency-limited gateway. chatJSON returns text|null, never throws. */
export class OpenCodeCognitionProvider {
  exePath: string; serverUrl: string; defaultModel: string;
  timeoutMs: number; maxConcurrent: number; enabled: boolean; cwd: string;
  private active = 0; private queue: Array<() => void> = [];
  lastError: string | null = null;
  lastRun: RunResult | null = null;
  lastSuccessAt: number | null = null;
  discovery = new ModelDiscovery();
  calls = 0; failures = 0;

  constructor(o: CognitionProviderOpts = {}) {
    this.exePath = o.exePath ?? process.env.OPENCODE_EXE ?? "opencode";
    this.serverUrl = o.serverUrl ?? process.env.OPENCODE_SERVER_URL ?? "";
    this.defaultModel = o.defaultModel ?? process.env.OPENCODE_MODEL ?? "opencode/space-bunny-free";
    this.timeoutMs = o.timeoutMs ?? Number(process.env.OPENCODE_TIMEOUT_MS ?? 60000);
    this.maxConcurrent = o.maxConcurrent ?? Number(process.env.OPENCODE_CONCURRENCY ?? 3);
    this.enabled = o.enabled ?? (process.env.OPENCODE_ENABLED ?? "true") === "true";
    this.cwd = o.cwd ?? process.env.OPENCODE_CWD ?? cognitionCwd;
  }
  status(): Record<string, unknown> {
    return { backend: "opencode-cli", enabled: this.enabled, model: this.defaultModel, exePath: this.exePath, serverUrl: this.serverUrl || null, active: this.active, queued: this.queue.length, calls: this.calls, failures: this.failures, lastError: this.lastError, lastSuccessAt: this.lastSuccessAt, lastDurationMs: this.lastRun?.durationMs ?? null };
  }
  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) { this.active++; return; }
    await new Promise<void>((res) => this.queue.push(res));
    this.active++;
  }
  private release(): void { this.active--; const n = this.queue.shift(); if (n) n(); }
  async chat(prompt: string, o: { model?: string; agent?: string; timeoutMs?: number } = {}): Promise<RunResult | null> {
    if (!this.enabled) return null;
    await this.acquire();
    try {
      this.calls++;
      const r = await runOpencode(prompt, { model: o.model ?? this.defaultModel, agent: o.agent, timeoutMs: o.timeoutMs ?? this.timeoutMs, exePath: this.exePath, serverUrl: this.serverUrl || undefined, cwd: this.cwd || undefined });
      this.lastRun = r;
      if (!r.text || r.errorType) {
        this.failures++;
        this.lastError = r.errorType ? `${r.errorType}: ${r.errorMessage ?? "unknown provider error"}` : (r.stderr.slice(0, 200) || `exit ${r.exitCode}`);
        return null;
      }
      this.lastError = null;
      this.lastSuccessAt = Date.now();
      return r;
    } catch (e) {
      this.failures++;
      this.lastError = e instanceof Error ? e.message : String(e);
      return null;
    } finally { this.release(); }
  }
  async chatJSON(prompt: string, _schemaHint: string, o: { model?: string; agent?: string } = {}): Promise<string | null> {
    const r = await this.chat(prompt, o);
    return r?.text ?? null;
  }
  async chatText(prompt: string, o: { model?: string; agent?: string } = {}): Promise<string | null> {
    return this.chatJSON(prompt, "{ reply: string }", o);
  }
  async models(refresh = false): Promise<string[]> { return this.discovery.list(this.exePath, this.serverUrl || undefined, refresh); }
}
