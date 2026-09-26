// AIProvider: OpenAI-compatible /chat/completions via fetch. Never throws: returns null on failure (sim continues).
export interface ProviderOpts { baseUrl: string; model: string; timeoutMs?: number; maxConcurrent?: number; enabled?: boolean; }
export class AIProvider {
  baseUrl: string; model: string; timeoutMs: number; maxConcurrent: number; enabled: boolean;
  private active = 0; private queue: Array<() => void> = [];
  lastError: string | null = null;
  constructor(o: ProviderOpts) {
    this.baseUrl = o.baseUrl.replace(/\/$/, ""); this.model = o.model;
    this.timeoutMs = o.timeoutMs ?? 15000; this.maxConcurrent = o.maxConcurrent ?? 4;
    this.enabled = o.enabled ?? false;
  }
  status(): { enabled: boolean; model: string; baseUrl: string; active: number; lastError: string | null } {
    return { enabled: this.enabled, model: this.model, baseUrl: this.baseUrl, active: this.active, lastError: this.lastError };
  }
  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) { this.active++; return; }
    await new Promise<void>((res) => this.queue.push(res));
    this.active++;
  }
  private release(): void { this.active--; const n = this.queue.shift(); if (n) n(); }
  async chatJSON(prompt: string, schemaHint: string, retries = 1): Promise<string | null> {
    if (!this.enabled) return null;
    await this.acquire();
    try {
      for (let a = 0; a <= retries; a++) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
          const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST", signal: ctrl.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: this.model,
              messages: [
                { role: "system", content: `Return ONLY valid JSON. Schema: ${schemaHint}` },
                { role: "user", content: prompt },
              ],
              temperature: 0.7, max_tokens: 500,
            }),
          });
          clearTimeout(t);
          if (!res.ok) { this.lastError = `HTTP ${res.status}`; continue; }
          const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
          const text = j.choices?.[0]?.message?.content ?? null;
          return text;
        } catch (e) {
          this.lastError = e instanceof Error ? e.message : String(e);
          if (a === retries) return null;
        }
      }
      return null;
    } finally { this.release(); }
  }
  async chatText(prompt: string): Promise<string | null> {
    const r = await this.chatJSON(prompt, "{ reply: string }");
    return r;
  }
}
