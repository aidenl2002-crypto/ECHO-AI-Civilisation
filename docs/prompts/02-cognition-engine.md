# PROJECT ECHO — COGNITION ENGINE

> OpenCode CLI is the primary AI cognition gateway. Local LLM support stays optional.

The deterministic sim owns reality. OpenCode provides cognition. The database owns memory. The event system owns history. AI owns nothing — a response is a proposed DECISION INTENT, validated and converted into legal actions (e.g. `CONFRONT_CITIZEN` only fires if the target exists, is reachable, and the actor has time).

## OpenCode as inference engine

`OpenCodeCognitionProvider` invoking non-interactive CLI (`opencode run --model <m> --agent <a> --format json "<prompt>"` or the best machine-readable equivalent of the installed version). Capture stdout/stderr/exit code/duration/model/retries. Prefer a persistent `opencode serve` + attach model over cold-starts per thought. Always check `opencode --help`, `opencode run --help`, `opencode models` and build around the ACTUAL installed CLI; tolerate upgrades.

## No NPC coding powers

Dedicated read-only/no-tool agents (`echo-reflex`, `echo-social`, `echo-planner`, `echo-business`, `echo-politics`, `echo-narrator`, `echo-historian`, `echo-dialogue`) with edit/bash/read/glob/grep/task/web denied. They reason only over supplied prompt text. Separate DEVELOPMENT OpenCode from RUNTIME COGNITION OpenCode. Runtime workspace (e.g. `runtime/opencode-brain/`) with minimal env, no secrets, no source. Prompts contain fictional sim data only.

## Models

No hardcoded IDs: discover via `opencode models`, cache, expose in SETTINGS → AI (provider, id, availability, role assignment, latency, failure rate). Configurable Model Pool per role (reflex/social/planning/business/government/dialogue/narrator/historian); one model may serve many roles. AI MODEL LAB benchmarks per task (structured compliance, social reasoning, planning, memory, grounding, dialogue, latency, reliability) — show per-task scores, never auto-declare "best".

## Cognition levels & attention

C0 mechanical (no AI) → C1 reflex (`echo-reflex`, cheap/utility-first) → C2 social → C3 tactical → C4 strategic (rare, strong model) → C5 narrative. `attentionScore` per citizen/event (severity, threat, novelty, finance, relation, goal relevance, uncertainty, surprise); only above-threshold events escalate.

## Budgeting & scheduling

Global caps (e.g. 6 concurrent runs, 500 queued, 3 deep thoughts/citizen/day, 10 narrative/min). Priority: player dialogue > critical events > relationship > business/government > tactical > social > flavour. `CognitionScheduler` queue with priority, expiry, staleness discard, state-version checks (`citizenVersion`, `worldTick`). Load shedding FULL/BALANCED/LIGHT/EMERGENCY; circuit breaker (10 fails/2min); per-role fallback chains ending in deterministic fallback. Async worker pool (2–6); dedup, cooldowns, group-event batching (deterministic first reactions, AI for the most affected), LOD0–3 with promotion to importance.

## Mind, memory, belief

`MindState` (goals, concerns, mood, relations, beliefs, unresolved events, thoughts, plans, identity summary — conclusions only, no chain-of-thought). Stable Identity Core; memory types (episodic/semantic/social/emotional/procedural) with importance/intensity/relevance/confidence/decay; top 5–15 retrieval; sleep consolidation (never rewriting facts). `Belief` (claim, confidence, source, evidence) — false beliefs drive behaviour. Gossip with trust-weighted acceptance, distortion, provenance. Deterministic emotion deltas; goal hierarchy (immediate → identity); utility+AI hybrid; bounded noise; values; secrets with knowers/sensitivity; group-relative reputation; natural language styles; structured civic lore; dreams disabled by default.

## Interaction & dialogue

Abstract encounters first; full dialogue only when observed/significant. Multi-turn capped (4–8), each side seeing only its own knowledge (theory-of-mind depth ≤ 2). Player TALK modes: observer vs in-world. Citizens never reveal unknown facts, never touch repo tools.

## Domain brains & narrative

Business/government decisions via owners/actors, never one omniscient LLM. `echo-narrator` presents real events only; `echo-historian` answers from retrieved evidence (documented vs interpretation vs uncertain); optional AI-suggested, sim-verified causal links.

## Observability & safety

Brain Monitor (queue, runs, models, roles, p50/p95 latency, success/parse-fail/timeout/retry, by-category, thinking citizens, stale discards), thought feed (input summary → decision → reason → result), heatmap overlay, per-citizen profiler. Prompt versioning (`social-decision-v3`) + admin PROMPT LAB (dry-run with context/JSON/validation/latency). Structured logs. Hallucination defence (entity validation; no retroactive facts). Death cancels cognition, preserves history. Standard envelope prompt + strict JSON schema + one repair retry, then fallback.

## Delivery

Adapter → discovery → router → worker pool → schemas → MindState → retrieval → beliefs → social/strategic/dialogue → telemetry → Brain Monitor → Prompt Lab. Then 3 E2E tests (Marcus passed-over → job search; Sarah/Evelyn false rumour propagation; grounded player dialogue), 100-citizen/5-year stress + 500-citizen LOD check, headless `--ai=off|normal|high`, brain replay records.

## Success

Dozens of citizens mostly living deterministically; meaningful events trigger personality- and history-differentiated cognition; memories, false beliefs, rumours, goals, plans; direct dialogue grounded in real life; hot-swappable multi-model roles; OpenCode failure never stops the world; Brain Monitor shows thoughts flowing; years of runtime without inference explosion. The city should make you think *"what the fuck are these people doing?"* — because nobody scripted it.
