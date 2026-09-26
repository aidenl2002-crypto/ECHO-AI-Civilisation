// decisions: request Tier2/3 decision from LLM, parse with shared validator. Fallback NONE.
import { SimCommand, validateSimCommand } from "@echo/shared";
import type { AIProvider } from "./provider.js";
const SCHEMA = '{ "action": "CONFRONT_PERSON|CHANGE_GOAL|POST_ECHONET|VOTE|BUY|NONE", "targetCitizenId": "optional", "reason": "string", "confidence": 0.0-1.0, "text": "optional for POST_ECHONET/CHANGE_GOAL" }';
export async function requestDecision(p: AIProvider, citizenCtx: Record<string, unknown>): Promise<SimCommand> {
  const fallback: SimCommand = { action: "NONE", reason: "AI offline or parse failed", confidence: 0 };
  const raw = await p.chatJSON(`Citizen context: ${JSON.stringify(citizenCtx)}. Decide the citizen's next social action.`, SCHEMA);
  if (!raw) return fallback;
  try {
    // extract JSON object from possibly chatty output
    const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) return fallback;
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    const v = validateSimCommand(parsed);
    return v.ok && v.value ? v.value : fallback;
  } catch { return fallback; }
}
export function parseStructured(text: string): SimCommand | null {
  try {
    const v = validateSimCommand(JSON.parse(text));
    return v.ok ? v.value : null;
  } catch { return null; }
}
