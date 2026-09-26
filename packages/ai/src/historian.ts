// historian: answer questions grounded ONLY in events/metrics. Cites event ids. No hallucination.
import type { SimEvent } from "@echo/shared";
import type { WorldMetrics } from "@echo/simulation-core";
export function answerHistory(question: string, events: SimEvent[], metrics: WorldMetrics[]): { answer: string; cites: string[] } {
  const q = question.toLowerCase();
  const cites: string[] = [];
  const lines: string[] = [];
  // keyword match over summaries
  const keywords = q.split(/[^a-z]+/).filter((w) => w.length > 3);
  const scored = events.map((e) => {
    const s = (e.summary + " " + e.type).toLowerCase();
    let sc = 0; for (const k of keywords) if (s.includes(k)) sc++;
    return { e, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.e.tick - a.e.tick).slice(0, 8);
  for (const { e } of scored) { lines.push(`Day ${e.day} [${e.id}] ${e.type}: ${e.summary}`); cites.push(e.id); }
  if (lines.length === 0) {
    const recent = events.slice(-5);
    for (const e of recent) { lines.push(`Day ${e.day} [${e.id}] ${e.type}: ${e.summary}`); cites.push(e.id); }
    return { answer: `No direct matches for "${question}". Most recent events:\n` + lines.join("\n"), cites };
  }
  const pop = metrics.length > 0 ? metrics[metrics.length - 1].population : "?";
  return { answer: `Based on ${scored.length} recorded event(s) (population ${pop}):\n` + lines.join("\n"), cites };
}
