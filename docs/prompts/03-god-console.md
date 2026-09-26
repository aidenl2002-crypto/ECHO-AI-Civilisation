# PROJECT ECHO — OWNER GOD CONSOLE

Complete owner-only admin panel inside the main web app — **ECHO CONTROL / GOD CONSOLE**: game-master console × simulation laboratory × intel dashboard × database inspector × world editor × developer console × cheat menu × god mode. Hidden from normal users; every button works or reads SYSTEM NOT IMPLEMENTED.

## 1. Access control

Owner-only: authenticated roles (OWNER/ADMIN/OBSERVER/USER, OWNER unrestricted by default), server-side permission validation (`world.read/modify`, `citizen.modify/kill/spawn`, `economy.modify`, `business.modify`, `government.modify`, `events.spawn`, `ai.inspect/control`, `system.debug/database` — never frontend-only hiding), direct-URL rejection, all mutations owner-authorised, all interventions logged, no secrets in frontend.

## 2–4. Route, design, command bar

Dedicated `/admin` (or `/control`) + distinct GOD CONSOLE nav. Dark control-room: left sidebar (World, Citizens, Businesses, Economy, Government, Relationships, Events, Chaos Lab, AI Brain, Map Tools, Time, Database, System, Audit Log), main panel, right live-telemetry rail (population, alive, births/deaths today, money supply, businesses, crime, happiness, AI queue, speed, date). Global `CTRL+K` natural-language command palette (simulation commands only, never shell) with autocomplete + destructive confirmations.

## 5–6. World & time machine

Pause/resume/step tick/hour/day, speed set, date/time/season/weather/world-name/seed controls, export/snapshots/duplicate/reset (confirmed). RUN UNTIL CONDITION (next election, a death, population N, first bankruptcy, unemployment > 25%) via sim conditions.

## 7–9. Citizens

Powerful search/filter/sort (name, ID, age, job, wealth, status, alive/dead, ownership, criminal, political, happiness, stress, health, AI activity, household, location; richest/poorest/oldest/most connected/most hated/most criminal…). Full admin profile: identity, physical, psychology, finance, job, household, relationships, memories, beliefs, goals, secrets, reputation, legal, AI cognition, event history, raw state. God actions: money ±, heal/injure/kill/revive, age, teleport, job/fire/promote, homeless/house, rich/bankrupt, debt, mayor/office, fame/reputation, skills, personality, mood, memory/belief/secret add-remove, forced meeting/argument/friendship/romance/breakup/marry/divorce/enemy, AI reset, goals — all validated domain commands, never ad-hoc SQL.

## 10–13. Kill, revive, spawn, presets

Kill = real death event + job/task/cognition/household/business/estate handling, history preserved (never row-delete). REVIVE via explicit `CitizenRevivedByAdmin`. Spawn random/custom/template/clone (+1/+10/+50/+100 with load preview). Presets: millionaire, broke, genius, ambitious, social, hermit, politician, entrepreneur, criminal, generous, aggressive, celebrity — editable.

## 14–19. Relations, memory, belief, goals, personality, needs

Two-citizen editor (trust, affection, attraction, respect, resentment, fear, loyalty, familiarity) + friend/enemy/romance/marry/divorce/rival/reset + shared history. Memory add/delete/importance/confidence/pin/forget + tagged IMPLANT FALSE MEMORY. Belief add/remove/confidence/source/public/private (admin-tagged experiments). Goal add/remove/priority/complete/fail. Trait sliders + randomise + extreme mode. Needs/mood edits + quick states (rest, starving, exhausted, max stress/happiness, heal all).

## 20–23. Money & business

Citizen money presets + custom/set/debt/transfer, every move ledgered via `ADMIN_MINT`/`ADMIN_REMOVE`. Economy dashboard + inject/remove, inflation/deflation, rates, forgive debt, wages/rent/food ×2/÷2, property crash/boom, recession/boom. MONEY DROP to one/household/area/random-10/everyone. Business search + cash/debt/bankrupt/close/reopen/owner/hire/fire/inventory/prices + spawner + MAKE BUSINESS TYCOON (real ownership).

## 24–28. Government, law, crime

Mayor/council/budget/tax/laws/approval/funds/election controls (trigger/cancel, funding, cash, pass/repeal — fictional politics). Editable rule sets. Crime board (today, wanted, suspects, arrests, prison) + abstract event/arrest/release/record actions only.

## 29–33. Chaos, rumours, secrets, events

CHAOS LAB cards (crash, boom, layoff, housing, food, blackout, bank collapse, inflation, debt forgiveness, strikes, migration, baby boom, decline, weather, fire, outbreak) — unimplemented systems disabled + labelled. Social chaos (trust, aggression, generosity, loneliness, ambition, risk, citywide rumour, secret reveals, mass events). Rumour creator (claim, subject, source, confidence, recipients, spread) + secret generator (true/false/partial) feeding belief propagation. Category event spawner — every action a real event.

## 34–38. Mass, map, teleport, entities, buildings

Bulk select-by-filter with affected-count preview. Map god tools (quick citizen/building menus, right-click teleport/spawn/event/building, overlays: wealth, crime, stress, happiness, population, revenue, unemployment, AI, relations, approval). Instant teleport (logged). Entity spawners with validated defaults. Building admin (owner, residents, workers, inventory, value, capacity; empty/close/destroy/restore with consequences).

## 39–47. Effects, favour, legends, possession, watchlists, AI

Citywide multipliers (0–10x, default 1x), timed effects with expiry/cancel, per-citizen temporary modifiers, MAKE IMMORTAL/INVULNERABLE (tagged), CLONE (new UUID), POSSESS (camera follow, manual acts, speech, schedule override, autonomy paused, clean return), pinned follow cards, admin-only watchlists. AI Brain control (models, roles, queue, latency; pause/resume/clear/force social/strategic/business/relationship/career with APPLY/DISCARD/RERUN). INTERROGATE (omniscient debug, separated from in-world talk) + labelled ADMIN OMNISCIENT DATA (never leaked into NPC prompts).

## 48–60. Debugger, inspector, logs, undo, snapshots, experiments, resets, extinction, miracles

Tick debugger (tick, durations, queues, entities, DB/WS/OpenCode stats, step + diff). Raw JSON inspectors (schema-validated edits). Filterable global event stream (admin visually distinct). Audit log (owner, timestamps, action, target, before/after, reason, request ID) with filter/export. UNDO where safe (REVERSIBLE / SNAPSHOT-REQUIRED / IRREVERSIBLE) + auto-snapshot before major destruction + snapshot CRUD/duplicate/branch compare + START EXPERIMENT (baseline → intervene → tracked report). Resets (economy, relations, minds, beliefs, crime, business — confirmed). ☠ MASS EXTINCTION (typed EXTINCTION confirm, real deaths). ✨ MIRACLE (heal, debt, food, energy, happiness, repairs). NUKE ECONOMY (severe recession), RANDOM CHAOS/BLESSING (mild→apocalyptic), PICK VICTIM/CHAMPION, GOD FAVOUR (−100…+100, default off), SPAWN LEGEND / AGENT OF CHAOS, HALL OF FAME/INFAMY + legacy views, heatmaps, live toasts, hotkeys, SAFE/MODERATE/DANGEROUS/WORLD-ALTERING tags + confirmations.

## 61–67. Architecture & delivery

Owner-protected `/api/admin/*` via central `AdminCommandBus` (validation, logging, undo, permissions, events); every admin action emits `source: ADMIN` events (historian-visible, optionally hidden from citizens/narrator but never from audit). No browser SQL (dev console local-only, opt-in). System admin (uptime, versions, DB, OpenCode, WS, CPU/RAM, TPS; restart engine, reconnect, health + VERIFY WORLD invariant checks + safe AUTO REPAIR previews). Paginated/virtualised lists, desktop-first dense UI. Tests: auth rejection, money ledger, kill/revive, bulk filters, audit, snapshots, no shell leakage; OWNER bootstrap via env (never hardcoded).

Usable when: search/inspect anyone; money ±; kill/revive/heal/teleport; personality/relation/memory/belief/goal edits; spawning; time control; economic effects; business/government/tax control; event spawning; force-thought; audit; snapshots. Then the fun: drops, extinction, miracles, chaos, blessings, victims, champions, immortals, possession, clones, rumours, secrets. Goal: complete command over a living civilisation — give Dave £10M or turn allies into enemies, then watch the sim handle the consequences.
