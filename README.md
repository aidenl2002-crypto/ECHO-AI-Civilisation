# Project Echo — "AI Civ": a living city of LLM citizens

Echo is a local-first simulation of **Echo City**: dozens of AI citizens live,
work, trade, vote, and chat, driven by a deterministic tick engine plus an
optional local LLM (LM Studio / Ollama) for cognition. SQLite by default,
Postgres optional. Monorepo: `apps/api` (sim + REST + SSE), `apps/web`
(observer UI), `packages/*` (shared sim-core, types, utils).

## Architecture

```text
                +------------------+     REST/SSE     +------------------+
                |    apps/web      | <--------------> |    apps/api      |
                |  observer UI     |  /api/* /events  |  Fastify/Express |
                +--------+---------+                  +--------+---------+
                         |                                     |
                         | imports                             | imports
                         v                                     v
                +------------------+                  +------------------+
                | packages/shared  | <--------------- | packages/        |
                | types + schemas  |                  | simulation-core  |
                +------------------+                  | deterministic    |
                                                      | tick engine      |
                                                      +--------+---------+
                                                               |
                              +---------------------------+    |
                              | local LLM (optional)      |<---+
                              | LM Studio :1234 / Ollama  |
                              | :11434 (OpenAI-compat)    |
                              +---------------------------+
                              Tier0-4 cognition (see below)

Persistence: SQLite (./data/echo.db) default | Postgres via DATABASE_URL (docker-compose profile `pg`)
```

## Requirements

- Node 20+
- SQLite default (no setup) / Postgres optional via Docker
- Local AI endpoint (optional but recommended): LM Studio (`http://localhost:1234/v1`)
  or Ollama (`http://localhost:11434/v1`), any OpenAI-compatible chat-completions server

## Install / Setup / Seed

```bash
cp .env.example .env        # edit LOCAL_AI_MODEL to your loaded model
npm install
npm run build
npm run migrate             # node apps/api/dist/db.js --migrate
npm run seed                # seeds Echo City (WORLD_SEED=1337, 40 citizens)
```

World seed default lives in `scripts/seed-default.json`:

```json
{ "cityName": "Echo City", "worldSeed": 1337, "startCitizens": 40 }
```

Override via `.env`: `CITY_NAME`, `WORLD_SEED`, `START_CITIZENS`.

## Dev / Prod / Test / Headless benchmark

```bash
npm run dev          # concurrently: apps/api + apps/web
npm run dev:api      # api only (workspace apps/api)
npm run dev:web      # web only (workspace apps/web)
node scripts/dev.mjs # sanity check that sibling apps/* exist

npm run build
npm start --workspace apps/api   # prod api (if defined by backend agent)

npm test             # sim-core + api tests
npm run sim:headless # headless benchmark, e.g.: npm run sim:headless -- --ticks 1000 --citizens 40
```

Docker (Postgres optional):

```bash
docker compose --profile pg up -d postgres   # db only, app still local
docker compose --profile pg up --build       # api + web + postgres
```

## Local AI config

| Var | Default | Meaning |
|-----|---------|---------|
| `LOCAL_AI_ENABLED` | `true` | `false` = Tier0 only, no LLM calls |
| `LOCAL_AI_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible base URL |
| `LOCAL_AI_MODEL` | `selected-model` | Model name loaded in LM Studio/Ollama |
| `LOCAL_AI_TIMEOUT` | `120000` | Per-request ms timeout |
| `LOCAL_AI_MAX_CONCURRENT` | `4` | Max parallel LLM calls |
| `PORT` | `4000` | API port |
| `DB_PATH` | `./data/echo.db` | SQLite path (ignored if `DATABASE_URL` set) |

Ollama example: `LOCAL_AI_BASE_URL=http://localhost:11434/v1 LOCAL_AI_MODEL=llama3.1`.

## Sim + AI cognition tiers

| Tier | Name | When | Cost |
|------|------|------|------|
| Tier0 | Rule-based | `LOCAL_AI_ENABLED=false`, or fallback/timeout | Free, deterministic |
| Tier1 | Observer summary | Periodic district/city digest (1 call / N ticks) | ~1 call / tick-batch |
| Tier2 | Citizen reaction | Notable events (job change, election, gossip) | Bounded by `LOCAL_AI_MAX_CONCURRENT` |
| Tier3 | Dialogue | Player talks to a citizen / citizen-to-citizen chat | On demand |
| Tier4 | Mayor / planner | Policy + zoning decisions each season | ~1 call / season |

Design rule: sim must advance even with LLM down — every tier degrades to Tier0.

## Folder structure

```text
.
├── apps/api/            # backend (sibling agent): sim loop, REST, SSE, db, seed
├── apps/web/            # frontend (sibling agent): map, citizens, chat, charts
├── packages/
│   ├── shared/          # shared types/schemas (exists)
│   └── simulation-core/ # deterministic engine (sibling agent, if split out)
├── scripts/
│   ├── dev.mjs          # workspace presence check
│   └── seed-default.json# default world seed (Echo City, 1337, 40)
├── tsconfig.base.json   # strict, ESM (NodeNext), @echo/* paths
├── docker-compose.yml   # postgres (profile pg) + api + web (profile full)
├── .env.example
└── package.json         # workspaces apps/* packages/*, concurrently dev
```

Root owns ONLY: `package.json`, `tsconfig.base.json`, `.env.example`,
`.gitignore`, `README.md`, `docker-compose.yml`, `scripts/*`. `apps/*` and
`packages/*` belong to sibling agents.

## Troubleshooting

- `npm run dev` fails with missing workspace: siblings haven't landed
  `apps/api` / `apps/web` yet — run `node scripts/dev.mjs` to confirm.
- LLM timeouts: lower `LOCAL_AI_MAX_CONCURRENT`, raise `LOCAL_AI_TIMEOUT`,
  or set `LOCAL_AI_ENABLED=false` to verify Tier0 sim still ticks.
- Wrong model name: must match exactly what LM Studio/Ollama serves
  (`LOCAL_AI_MODEL`); check `<base-url>/models`.
- SQLite locked: stop other `api` instances; delete `./data/echo.db-journal`
  only when no process is running; or switch to Postgres via `DATABASE_URL`.
- ESM import errors: packages use `NodeNext`; import with explicit `.js`
  extensions from compiled output; extend `tsconfig.base.json`, don't fork it.
- Port clash: change `PORT` (api) / Vite port (web); update web's `VITE_API_URL`.
