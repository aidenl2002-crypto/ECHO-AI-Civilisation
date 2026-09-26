// Newspaper assembled from actual simulation events. AI polish is optional.
import type { SimEvent } from "@echo/shared";
export interface Edition { day: number; headline: string; articles: Array<{ headline: string; body: string }>; stats: Record<string, number>; }
export function generateEchoTimes(day: number, events: SimEvent[], polish: string | null = null): Edition {
  const todays = events.filter((e) => e.day === day);
  const byType: Record<string, number> = {};
  for (const e of todays) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const notableTypes = new Set(["CitizenDied", "ChildBorn", "CitizenBorn", "BusinessCreated", "BusinessClosed", "CrimeCommitted", "Arrested", "ElectionWon", "LawChanged", "GodIntervention", "MigrantArrived"]);
  const notable = todays.filter((e) => notableTypes.has(e.type));
  const talked = byType.CitizenTalked ?? 0;
  const payday = byType.Payday ?? 0;
  const meals = byType.MealEaten ?? 0;
  const articles: Edition["articles"] = [];
  const lead = notable.at(-1);
  let headline = "A quiet day in the city";
  if (lead) {
    headline = lead.summary;
    articles.push({ headline: lead.summary, body: `On day ${day}, ${lead.summary.charAt(0).toLowerCase()}${lead.summary.slice(1)}. The event was recorded in the city timeline.` });
  }
  if (talked > 0) {
    if (!lead) headline = "Conversations carry across the city";
    articles.push({ headline: "Neighbours find time to talk", body: `${talked} citizen conversation${talked === 1 ? " was" : "s were"} recorded today. Follow the exchanges on EchoNet.` });
  }
  if (payday > 0 || meals > 0) {
    if (!lead && talked === 0) headline = "Daily life keeps the city moving";
    const details = [payday > 0 ? `${payday} pay packet${payday === 1 ? "" : "s"} issued` : null, meals > 0 ? `${meals} meal${meals === 1 ? "" : "s"} eaten` : null].filter(Boolean).join(" and ");
    articles.push({ headline: "Around town", body: `The city's ordinary routines continued on day ${day}: ${details}.` });
  }
  for (const event of notable.slice(-4).reverse()) {
    if (event.id === lead?.id) continue;
    articles.push({ headline: event.summary, body: event.summary });
  }
  if (articles.length === 0) articles.push({ headline: "The city is finding its rhythm", body: `No major events have been recorded on day ${day} yet. Check back as the city lives through the day.` });
  if (polish) articles.push({ headline: "Editor's note", body: polish.slice(0, 300) });
  return { day, headline, articles, stats: byType };
}
