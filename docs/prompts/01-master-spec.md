# PROJECT ECHO

## Autonomous AI Civilisation Sandbox / Persistent Open-World Society Simulator

> BUILD A WORLD THAT GENERATES STORIES RATHER THAN BUILDING STORIES DIRECTLY.

Ambition: **The Sims + RimWorld + Dwarf Fortress + SimCity + Crusader Kings + an open-world city simulator + local LLM agents** — completely original in implementation, world, UI, characters, branding, and assets.

This is NOT a chatbot playground, NOT a scripted story generator, NOT agents merely messaging each other. It must behave like a genuine living city: inhabitants with persistent state who decide, relate, work, earn, spend, move, organise, remember, opine, commit crimes, form families, start businesses, influence politics, spread information, and die. Emergent stories, never predefined narratives.

---

# 1. CORE DESIGN PRINCIPLES

## 1.1 Simulation first, LLM second

Never use an LLM for logic handled deterministically (hunger checks, salaries, money movement, inventory, wages, tax, rent, mortality, revenue, loans, births, scheduling, travel, employment, ownership, health, enforcement, elections, prices, property, statistics).

Use AI only for semantic judgement, planning, creativity, interpretation, social reasoning — e.g. choosing how to react to a spouse's affair from deterministic context (relationship, evidence, emotion, memories, stress, personality, trust, aggression, dependency, friendships, consequences).

Chosen actions convert back into structured simulation commands.

---

# 2. LOCAL-FIRST AI (historic — superseded by OpenCode cognition spec)

Systems were designed around locally hosted models via OpenAI-compatible endpoints (LM Studio, Ollama, llama.cpp, vLLM, LocalAI) behind an `AIProvider` abstraction (base URL, model, temperature, tokens, timeout, retries, structured JSON, context limits, remote fallback), configured via env + admin UI. The sim must never freeze when inference is offline.

> NOTE: the COGNITION ENGINE spec later replaced local LLM with OpenCode CLI as the primary gateway. Local support remains optional.

---

# 3. PERFORMANCE PHILOSOPHY

Tiered cognition (mandatory):

- **Tier 0 — Pure simulation:** walking, sleeping, eating, working, spending, bills, commuting. No AI.
- **Tier 1 — Utility decision engine:** cheap deterministic scoring (e.g. hungry → eat home / restaurant / groceries / skip, scored on hunger, wealth, distance, schedule, personality, availability).
- **Tier 2 — Lightweight AI:** socially meaningful/ambiguous (job offers, confrontations, elections, deals, gossip).
- **Tier 3 — Deep cognition:** rare — life decisions, strategy, conspiracies, crises, ideology, long-term plans.
- **Tier 4 — Narrative:** newspaper, biographies, histories, dialogue, radio.

---

# 4. WORLD

Initial town **ECHO CITY** (configurable). Start: **40 citizens**, ~20 buildings, roads, homes, shops, town hall, police station, clinic, bar/pub, restaurant, grocery, warehouse/factory, bank, school, park. Every location: ID, type, position, capacity, owner, occupants, workers, inventory, hours, economics, relations.

# 5. TIME ENGINE

Central clock: pause, 1x/2x/5x/10x/50x/100x/max. Calendar: hours/days/weeks/months/years/seasons. Discrete 5-minute ticks, decoupled from FPS. Systems run at own frequencies (movement/needs per tick, economy hourly/daily, salary weekly/monthly, tax monthly, cognition event-driven, birth/death daily, government periodic). Configurable.

# 6. CITIZEN MODEL

Persistent entities: identity (UUID, names, sex, DOB, age, birthplace, avatar seed, bio, alive), physical (health, hunger, energy, fitness, illness, injuries, lifespan), psychology (openness, conscientiousness, extraversion, agreeableness, neuroticism, empathy, ambition, greed, aggression, loyalty, impulsiveness, risk tolerance, patience, honesty, curiosity, romantic tendency, conformity, authoritarianism, generosity — normalized, behaviour-driving), skills (labour, construction, medicine, teaching, management, sales, cooking, logistics, policing, finance, persuasion, reasoning, charisma, criminal — improving with experience), emotions (happiness, stress, anger, fear, loneliness, confidence — decaying), financial (cash, bank, income, debt, credit, assets, property, investments, recurring expenses), employment, housing, relationships, beliefs (incl. false/uncertain — FACT vs BELIEF distinction is critical).

# 7. MEMORY SYSTEM

Structured memories (not transcripts): `{subject, event, amount, sentiment, importance, timestamp, confidence}`, typed (interaction, relationship, favour, insult, betrayal, financial, crime, gossip, accomplishment, trauma, romantic, workplace, political, observation) with importance/valence/confidence/decay/people/location/event. Old trivia decays; trauma persists; low-confidence may misremember.

# 8. RELATIONSHIPS

Multi-dimensional (familiarity, trust, affection, attraction, respect, resentment, fear, dependency, loyalty), typed (stranger → spouse/ex/family/coworker/boss/rival/enemy). Changed by interaction history.

# 9. SOCIAL INTERACTIONS

Proximity/work/home/business/event-driven encounters, usually resolved cheaply (`"Marcus chatted with Evelyn during lunch."`). Full AI dialogue only when observed, important, or decision-relevant.

# 10. ECONOMY

Closed/semi-closed: wages, food, rent, services, loans, savings, unemployment, property, businesses (revenue, payroll, inventory, tax, rent, P/L, hire/fire/fail/expand). Stats: GDP proxy, avg/median income, unemployment, inequality, inflation, business count, bankruptcies, spending, tax revenue. Money conserved; debug money flows.

# 11. BUSINESS SYSTEM

Founder/shareholders/employees/cash/debt/inventory/suppliers/expenses/revenue/industry/reputation/pricing/payroll. Industries: grocery, restaurant, bar, construction, logistics, manufacturing, healthcare, finance, retail, property. Entrepreneurs spot gaps (e.g. second grocery store). Occasional AI strategy.

# 12. JOB MARKET

Real job entities; search by skill/pay/distance/personality/status/qualifications/network. Hiring by budget/need/skill/reputation. Nepotism possible.

# 13. PROPERTY

Rent/own/landlord/purchase/inherit/homeless. Supply affects rent. Later: mortgages, values, construction, zoning.

# 14. GOVERNMENT

Mayor + council: tax, police/healthcare funding, welfare, infrastructure, budget. Periodic elections; votes from beliefs/interests/relations/experience/policy (never random). Campaigns, promises, endorsements, scandals. All fictional.

# 15. LAW AND CRIME

Fictional abstract crimes (theft, fraud, burglary, assault, vandalism, corruption, tax evasion) driven by desperation/aggression/greed/morality/impulsivity/influence/opportunity/fear. Police by reports/evidence/staffing/priority. Suspects/witnesses/victims/arrest/charge/convict. No real-world technique instruction.

# 16. HEALTH

Simplified sickness/injury/recovery/treatment/death; quality matters.

# 17. FAMILIES AND GENERATIONS

Dating/partnership/marriage/breakup/children/households/inheritance. Procedural trait inheritance (parents + randomness + environment). Schooling, workforce entry, viewable family trees.

# 18. INFORMATION NETWORK

World truth ≠ public knowledge. Events: unknown → witnesses → rumour → widely known → media. Rumours mutate (`accused` becomes `did`). Citizens react to belief.

# 19. MEDIA — The Echo Times

Daily digest derived ONLY from the event log (editorial tone allowed, facts grounded).

# 20. SOCIAL NETWORK — EchoNet

Posts (thoughts, complaints, news, gossip, ads, politics, updates), follows/likes/replies/shares; influences beliefs.

# 21. CITY MAP

Interactive 2D: pan/zoom/markers/roads/movement/names/selection → citizen/business profiles. React + TypeScript; PixiJS or Phaser. Render separate from sim state.

# 22. CITIZEN PROFILE UI

Name/age/job/wealth/home/health/mood/status, personality graphs, skills, relationships, memories, activity, goals, events, financial/employment history, family tree, posts. Ask `"Why are you angry with Marcus?"` → in-character grounded reply.

# 23. GOD MODE

Interventions: citizens, money, tax, businesses, recession/boom, fire, outbreak, food shortage, crime ±, housing, unemployment shock, technology, law, migrants, blackout; personal (wealth, immortality, traits, meetings, secrets, scandals, groups, collapse). All logged.

# 24. CHAOS LAB

Experiments (wealth drop, 90% tax, automation shock, no police, housing crisis) with real-stat summaries.

# 25. EVENT SYSTEM

Typed persisted events (born/died/hired/fired/married/split/business/crime/arrest/election/law/money/property…) enabling history, debugging, analytics, news, historian, replay.

# 26. AI HISTORIAN

Grounded Q&A (`"Why did the economy collapse in Year 8?"`) from DB + events + metrics + relations. No hallucinated history.

# 27. TIMELINE

Filterable (politics, economy, crime, relationships, births, deaths, business, disaster); click to inspect.

# 28. STATISTICS DASHBOARD

Population, wealth avg/median, GDP, unemployment, crime, births/deaths, businesses, revenue/spending, housing/food prices, happiness, inequality — historical graphs.

# 29. SAVE SYSTEM

Autosave/manual/slots/export/import/backups surviving restarts. Real DB (PostgreSQL preferred; SQLite dev-mode allowed).

# 30. ARCHITECTURE

Monorepo (`/apps/web|simulator|api`, `/packages/shared|simulation-core|ai|database|events|types`): React+TS+Vite, Node+TS, PostgreSQL, Prisma/Drizzle, WebSockets, Redis optional, OpenAI-compatible AI, Docker Compose optional. Modular monolith first.

# 31. SIMULATION LOOP

Clock → schedules → movement → needs → workplaces → businesses → economy → social → government → health → events → cognition queue (async, non-blocking) → apply decisions → emit UI → persist.

# 32. STRUCTURED AI OUTPUT

Schema-validated intents only (e.g. `{action: CONFRONT_PERSON, targetCitizenId, reason, confidence}`); reject/retry invalid; never eval or run model code.

# 33. AGENT CONTEXT BUILDER

Minimal relevant context per request (traits, emotion, relations, memories, finances, evidence, goals, actions). Tight token control.

# 34. GOAL SYSTEM

Short/medium/long-term goals influencing decisions; revisable after major events.

# 35. SCHEDULING

Dynamic routines (07:00 wake … 23:00 sleep); unemployed/shift/weekend variants.

# 36. OBSERVATION MODES

City, follow-citizen, household, business, news, social, history, data, god.

# 37. DEBUG MODE

Tick time, citizen time, AI queue/tokens/calls, event depth, DB latency, counts, money supply, errors; raw citizen inspect; pause + single-step; speed control.

# 38. DETERMINISM

Seeded RNG world seed; reproducible mechanics (AI inherently fuzzy).

# 39. ECONOMIC INTEGRITY TESTS

Money conservation, inventory ≥ 0, dead can't act, single location, no overdraft payroll, ownership totals, vote counts, valid relations, monotonic event time; dev invariant checks.

# 40. SIMULATION TEST HARNESS

Headless runs (e.g. 100 citizens × 10 years): runtime, population, wealth, businesses, crashes, invalid states, metrics.

# 41. WORLD GENERATION

Configurable (name, seed, population, difficulty, wealth distribution, crime, government, AI intensity, complexity) with pre-existing families, history, relations.

# 42–43. VISUAL STYLE / START SCREEN

Surveillance/control-room × city sim: dark, dense, map-first. NEW / CONTINUE / LOAD / LAB / SETTINGS / AI STATUS (endpoint, model, latency, queue, errors; hot-swap; per-task models).

# 44–46. LOCAL AI STATUS / BUDGET / PROMPT LOGGING

Concurrency cap (~4), priority tiers (player > critical > relationship > business > news > flavour), dev prompt/response/decision inspection.

# 47. INITIAL EXPERIENCE

40 citizens, 12 households, 8 businesses, 20 buildings, government, jobs, economy — running immediately: movement, salaries, purchases, needs, relationships, inspector, newspaper, speed/pause, god actions.

# 48. PHASED DEVELOPMENT

1. Living Town (clock, citizens, buildings, movement, jobs, money, needs, homes, business, relations, events, map, inspector, save/load, AI abstraction) — playable.
2. Society (memory, friendship, dating, family, EchoNet, Times, cognition).
3. Economy (creation, loans, property, supply chains, prices, unemployment, bankruptcy).
4. Government (elections, tax, budget, laws, services).
5. Crime (crime, police, justice).
6. Generations (births, school, inheritance, aging, dynasties).
7. Advanced emergence (factions, religion, orgs, ideology, protests, unions, corporations, media, tech, migration, culture).

# 49–51. ENGINEERING RULES / README / DEV ENV

No fake buttons, no silent mocks, typed models, migrations, validation, clear logs, docs. `npm run dev` starts everything.

# 52. FIRST DELIVERY TARGET

Launch → create city → 40 citizens → time advances → commute/work/salary/food/needs/relations → full inspector → speed/pause → save → restart → reload identical → local LLM Q&A grounded → Echo Times from real events.

# 53. EMERGENT STORY REQUIREMENT

Years of runtime must produce unscripted sagas (job loss → debt → divorce → crime → arrest → politicised child → council run → funded opponent → divided town → bribery exposé → protests). Nothing hardcoded.

# 54–55. IMPLEMENTATION / VISION

Inspect dir → monorepo → architecture → schema → clock → citizens → buildings → jobs → economy → movement → events → WebSocket → UI → inspector → save/load → AI abstraction → first AI dialogue → tests → run → fix → multi-year headless → fix systemic failures. Foundations for thousands of agents, regions, wars, transport, 3D, voice, media, dynasties — **a tiny artificial society inside the computer.**
