# PROJECT ECHO — Whole-Project Brief

> Read this first. It describes everything this repo is, how it runs, and the rules for working in it. Companion specs live in `docs/prompts/` (01 master sim spec, 02 cognition engine, 03 god console, 04 frontend rebuild).

## 1. What this is

**PROJECT ECHO** = a persistent autonomous civilisation simulator ("a tiny artificial society living inside the computer") plus its interfaces:

- **Deterministic simulation engine** — the authority on world state. Time, movement, needs, jobs, economy, relationships, birth/death, government, crime. Never asks AI about mechanics.
- **OpenCode cognition brain** — event-driven AI reasoning (C0–C5 tiers). AI returns validated DECISION INTENTS only; it never writes world state directly.
- **ECHO OS web UI** — cinematic living-city interface: map, people, economy, news, social, history, AI Brain, God Console.
- **God Console** — owner-only admin panel (search/edit/kill/revive/spawn anyone, economy/government control, chaos lab, snapshots, audit).

Guiding rule: **BUILD A WORLD THAT GENERATES STORIES, NOT STORIES.** Emergence over scripting. Second rule: **no fake controls** — every button works or is visibly disabled as SYSTEM NOT IMPLEMENTED.

## 2. Current status (2026-09-26)

Playable end-to-end. Verified: `npm run build` clean on all workspaces, **18/18 tests pass** (`npm test`), headless 1000-tick/40-citizen runs with 0 crashes, live HTTP-verified API + UI + brain endpoints, screenshot-verified CITY view at 2560×1440.

| System | State |
|---|---|
| Sim core (clock, citizens, buildings, movement, jobs, economy, social, life) | Done, 7 invariant tests green |
| API + SQLite persistence + WebSocket | Done |
| ECHO OS frontend rebuild | Done, build clean, zero console errors |
| OpenCode cognition (provider, scheduler, mind/belief/memory, Brain UI) | Done, 9 tests incl. live gateway probe |
| God Console backend (`admin.ts`) + panel | Done, 9/9 tests, HTTP-verified |
| Generations/politics depth, factions, 3D | Future (see §11) |

Known cosmetic issue: economy "Top Jobs" list shows raw job IDs (`j_extra_25`) — needs proper job-name mapping.

## 3. Run it (user's PC, Windows, Node 20+)

- Double-click **`START-ECHO.bat`** — installs deps (first run), builds backend, starts API (`:4000`) + web (`:5200`), opens browser. Close the two ECHO windows or run **`STOP-ECHO.bat`** to stop (frees ports 4000/5200; leaves port 5173 and any `npm run dev` alone).
- Manual: `npm install`, `npm run build --workspace apps/api`, `node apps/api/dist/server.js`, and in `apps/web`: `npx vite --port 5200 --host 127.0.0.1 --strictPort`.
- `.env` (already created from `.env.example`): `PORT`, `DB_PATH` (SQLite, auto-created), `CITY_NAME`, `WORLD_SEED`, `START_CITIZENS=40`, `OWNER_TOKEN=owner-dev` (God Console), `OPENCODE_*` (brain config).
- Tests: `npm test`. Headless sim: `node apps/api/dist/headless.js --ticks 1000 --citizens 40`.
- God Console: paste `OWNER_TOKEN` into the UI's God Key box, or visit `/#/control`.

## 4. Monorepo layout

```
apps/api/            Express + WS + SQLite (better-sqlite3) + sim host
  src/server.ts      All public endpoints + frontend-compat DTO adapters
  src/admin.ts       Owner-only /api/admin/* (auth, AdminCommandBus, audit, ledger)
  src/db.ts          Save slots / snapshots (data/echo.db)
  src/simManager.ts  Engine singleton, background ticker, WS broadcast
  src/headless.ts    CLI benchmark runner
  tests/             admin.console + cognition.{jobsearch,gossip,dialogue,gateway}
apps/web/            React + TS + Vite (dev :5200, proxy /api → :4000)
  src/App.tsx, store.tsx, chrome.tsx   Shell, polling store, top bar + rail + panels
  src/map/CityMap.tsx                  Canvas city renderer (sprites, day/night, LOD, overlays)
  src/views/  CityView People Society Economy Cognition God
  src/admin/  Legacy God Console panel (preserved; God view reskins it)
  src/api.ts  Typed fetch wrappers (source of truth for the contract)
packages/shared/     Domain types: Citizen, Building, Job, Relationship, Memory, SimEvent union, Goal, EchoPost, SimCommand + validator
packages/simulation-core/  rng, clock (5-min ticks, 288/day), world gen (seeded, 40 citizens/20 buildings/8 businesses), systems/*, engine (tick order, drainCognitionEvents, applyAIDecision, save/load)
packages/ai/         provider (OpenAI-compat, offline fallback), opencode gateway, roles router, scheduler (pool+queue+staleness+breaker), mind (memory/belief/goals/C0-C5/LOD), envelope prompts, brains (business/gov/narrator/historian), newspaper, contextBuilder, decisions
.opencode/agents/    echo-{reflex,social,planner,business,politics,narrator,historian,dialogue}.md — tool-denied, prompt-only
runtime/opencode-brain/  Cognition sandbox config (no secrets; prompts carry fictional data only)
docs/prompts/        The four founding spec prompts (01–04)
scripts/             seed-default.json, dev.mjs
```

Workspace packages are `@echo/shared`, `@echo/simulation-core`, `@echo/ai`, `@echo/api`, `@echo/web`. ESM (`"type": "module"`), strict TS with `.js` import suffixes.

## 5. Simulation essentials

- **Tick = 5 sim-minutes.** Fixed tick order: schedule → needs → movement → economy → social → life → metrics@midnight → clock. Ticker: `speed × 2 ticks/sec`; speed cap **100**.
- **World gen** (`createWorld(seed, cityName, n)`): 40 citizens (18-trait psychology, 14 skills, needs, finances, jobs ~70% employed, households, sparse relations), 20 buildings (homes, grocery, restaurant, bar, factory, bank, clinic, school, park, town hall, police…), 8 businesses. Fresh worlds start with **empty** `events[]`/`posts[]` — history accumulates.
- **Engine LLM contract**: `drainCognitionEvents()` → candidates; `applyAIDecision(id, cmd)` validates via shared `validateSimCommand`. Main loop never blocks on AI.
- **Money**: `totalMoney(state)` includes inventory at cost (meal=3, other=2) — keep valuation in sync with restock or the conservation invariant breaks.
- **`/api/new` resets everything**: state + clock + RNG (fixed 2026-09-26; previously inherited the old clock). Response echoes `{ok, seed, snapshot}`. Seeds may be strings (`"echo-1"` → FNV-hashed).

## 6. API contract (see `apps/web/src/api.ts` + `server.ts`)

Public (frontend-shaped DTOs): `GET /api/state` (clock/speed/paused/counts/cityName/seed), `/api/citizens`, `/api/citizens/:id` (full profile + raw), `/api/buildings`, `/api/events?limit`, `/api/metrics`, `/api/newspaper/:day`, `/api/echonet` (+POST), `/api/timeline`, `/api/ai/status`, `/api/money`, `/api/debug`, `POST /api/new|/api/world/new|/api/save|/api/load|/api/tick|/api/step|/api/speed|/api/pause|/api/goals`, `/api/god/*` (give-money, spawn-business, recession, boom, outbreak, add-migrant), `/api/citizen/:id/ask|/decide`.
Brain: `/api/ai/models|refresh-models|roles|config|connection|intensity|benchmark`, `/api/brain/status|feed|think|heatmap`, `/api/citizen/:id/mind`, `/api/prompt-lab/run`.
Admin (`Bearer OWNER_TOKEN`, every mutation audited with before/after + `source:ADMIN` event; money via `ADMIN_MINT`/`ADMIN_REMOVE`; kill = real death + cleanup, never row-delete; extinction needs `{"confirm":"EXTINCTION"}`): full citizen/business/economy/government/crime/effect/rumour/secret/event/snapshot/time/invariant/force-think surface in `admin.ts`. Roles: OWNER > ADMIN (no `system.database`) > OBSERVER (read) > USER.

## 7. Frontend (ECHO OS) notes

Token system in `index.css` (`#07090D` bg etc.); Inter/Manrope/Space Grotesk, mono only for IDs/ticks; Lucide-style inline icons; LOD map (districts → points → avatars + AI rings); right-drawer citizen inspector (Overview/Mind/Social/Finance/Career/Memories/History); relationship SVG graph; deterministic avatar seeds; Ctrl+K palette; Space pause; F follow; error boundaries per module; nothing imports dead `src/components/*` (removed).

## 8. Cognition notes

OpenCode CLI v2.0.16 quirks (handled in `packages/ai/src/opencode.ts`): `--format json` emits **JSONL** (concat `type:text`, surface `type:error`); **close child stdin** or `run` hangs; free tier 403s custom `--agent` → retry without it (role instructions live in the envelope). Default model `opencode/muse-spark-1.3-contributor-free`. Scheduler: concurrency 2–6, staleness window ~500 ticks, 90s timeouts, repair-retry then deterministic fallback; circuit breaker 10 fails/2min; shedding FULL/BALANCED/LIGHT/EMERGENCY. Free-tier latency 3–70s is normal. Thought summaries only — never chain-of-thought. Prompts must contain fictional sim data, never env/files.

## 9. Working rules for future agents

1. **Don't rebuild working systems.** Inspect first; extend.
2. **Respect ownership in flight**: one agent per area (`apps/web`, `apps/api+cognition`, root config). Retry reads on conflict; never overwrite a sibling's files.
3. **Simulation owns reality; AI proposes; admin logs.** No direct state writes from AI output; no ad-hoc SQL from frontend; all admin money kill/revive flows go through the established command paths.
4. **Keep the contract green**: after changes run `npm run build --workspaces`, `npm test` (18 tests), boot API + UI, click through, screenshot CITY at 2560×1440.
5. **Ports**: API 4000, web 5200. Never touch the user's :5173 app. Kill only what you started; `STOP-ECHO.bat` is the user's.
6. **No placeholders.** Unavailable backends render disabled `SYSTEM NOT IMPLEMENTED`.
7. Write long reasoning as private chain-of-thought, never as code comments.

## 10. Troubleshooting

- `EADDRINUSE :4000` → a previous server survived; `STOP-ECHO.bat` or kill the `dist/server.js` PID.
- Blank UI / proxy errors → API must be up first (`/api/state` should 200); use vite **dev** (has the `/api` proxy), not `vite preview`.
- `/api/new` then empty History/Social → normal until ticks accumulate (fresh worlds start eventless).
- Brain slow/empty → free-model latency is 3–70s; check `/api/brain/status` queue + circuit state; sim runs identically offline.
- Money invariant failing → check inventory valuation vs restock cost (§5).

## 11. Roadmap (from the founding specs)

Society depth (dating/family dynasties), economy (loans, property market, bankruptcies), government (elections, tax, laws), crime/justice loop, generations (school, inheritance), advanced emergence (factions, orgs, protests, culture), multi-city/regions, 3D, voice/radio. Phase order and full detail: `docs/prompts/01-master-spec.md`.
