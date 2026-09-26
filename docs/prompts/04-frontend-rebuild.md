# PROJECT ECHO — COMPLETE FRONTEND REBUILD (ECHO OS)

Current frontend is FUNCTIONAL but visually unacceptable (flat grid, square buildings, tiny text, cramped tabs, monospace everywhere, dead dark space, zero sense of life). This is a full experience rebuild — reconceptualise, don't reskin. Target feeling: *"Holy shit, this is an actual living AI city."* Premium strategy-game × intel-dashboard × futuristic-OS × city-digital-twin. Original identity: **ECHO OS**.

## 1. Inspect first

Map the existing React structure, routes, state, WebSocket data, controls, inspector, businesses, news, social, history, analytics, God Console, AI Brain, debug, APIs, map, events. Preserve all working functionality; reuse ugly-but-working logic; refactor tight coupling. No backend rewrites except tiny compat shims.

## 2–4. Design language, colour, type

Dark cinematic layered precise alive dense clean premium responsive: near-black `#07090D`, panels `#0D1117`, raised `#111821`, blue-grey borders, cyan primary, violet secondary, emerald/amber/red status, domain hues (citizen cyan, business violet, government gold, health teal, crime red, social pink, AI purple). Never all-blue; no SaaS/Bootstrap/terminal/cyberpunk clichés. Inter/Geist/Manrope/Space Grotesk for UI; monospace ONLY for IDs, timestamps, ticks, telemetry. Aggressive type hierarchy, tabular numerals. CSS tokens for all of the above; Lucide icons (no emoji chrome); 8–14px radii; glass sparingly on overlays; subtle shadow/glow.

## 5–7. Shell, nav, world bar

Desktop-first: left nav rail + center world + right context panel + top status bar + bottom event/time strip. City dominates; sidebars collapsible/resizable/context-aware. Rail: logo, world name, CITY/PEOPLE/BUSINESSES/ECONOMY/GOVERNMENT/SOCIAL/NEWS/HISTORY/DATA/AI BRAIN/GOD CONSOLE (icon-collapse, glow active), settings/notifications/health/avatar at bottom. Top bar: city + YEAR/DAY/season/time; live pop/happiness/GDP/unemployment/crime/AI-thoughts; game-feel Pause/1x–100x/MAX/Step/calendar/settings with obvious active speed + shortcuts.

## 8–13. City map (most important)

Beautiful performant 2D/2.5D digital twin (PixiJS/Phaser or excellent canvas/SVG): roads connecting places, blocks, plots, parks, district bounds, lighting, moving citizens, activity glow, ambient motion. Procedural per-type building art (blue-grey homes, warm shops, violet commercial, gold civic, police blue, health teal, steel industrial, amber hospitality, green parks) — never plain squares. Smooth pan/zoom/focus/follow, double-click focus, animated transitions, reset/fit. Depth: shadows, road glow, night streetlights, day/night shift from sim time (morning cool, day neutral, evening warm, night dark blue with lit windows), subtle season tints, fog/vignette. Citizens: distant glow points → medium avatar dots → close names/activity/mood/job icons; smooth interpolation; activity glyphs (sleep/work/eat/social/shop/crime/health/AI ring) only at sufficient zoom.

## 14–20. Citizen experience

Click → right context drawer (avatar, name, age, job, activity, mood; tabs OVERVIEW/MIND/SOCIAL/FINANCE/CAREER/MEMORIES/HISTORY), never a raw-text takeover. Overview: health/energy/hunger/happiness/stress/money/satisfaction/relations as bars/rings/sparklines/cards + goals/events/location/household/closest bonds. Deterministic seeded avatars, permanent per citizen. MIND view: mood, concerns, goals, beliefs, memories, plans, cognition history, current thought summary (no chain-of-thought). Interactive relationship graph (green/red/pink/gold/grey, thickness = strength, click-navigate). Route line + ETA on select; hover previews; pinning.

## 21–22. Business & dashboard

Business screens: logo/icon, industry, owner, status; revenue/profit/staff/cash/debt/customers/reputation cards; animated history charts; employee avatars; VIEW ON MAP. City overlay dashboard: population, births/deaths, households, businesses, employment, happiness, crime, housing, money supply with trends — compact, no card-soup.

## 23–24. Events

Elegant live feed (bottom-left overlay/drawer, ALL/SOCIAL/ECONOMY/CRIME/BUSINESS/GOVERNMENT/AI filters, severity-weighted). Cinematic takeover cards for major events only (bankruptcy, elections…) with severity settings.

## 25–28. News, social, history, data

Echo Times as a real digital newspaper (hero headline, sections, expandable articles, grounded in events). EchoNet as a real social app (avatars, jobs, timestamps, replies/likes/shares, trending, popular citizens, business ads, government notices, rumours). History as zoomable day/month/year timeline archive with type filters + inspect. Data as a serious themed dashboard (population, GDP, wealth, median income, unemployment, happiness, crime, births/deaths, business, housing, budget, inflation, food, relations, cognition) with hover/ranges/comparisons/event markers.

## 29–30. AI Brain

ECHO COGNITION NETWORK: ONLINE status, workers, queue, thoughts/min, latency, active models; animated live cognition feed (who, type, trigger → decision, model, latency); worker nodes, queue activity, errors, thought heatmap + map AI-activity overlay.

## 31–32. God Console & Chaos Lab

Dangerous-powerful black/red/amber styling (ECHO CONTROL, OWNER AUTHORITY), warning states on destructive picks. Chaos Lab cards (collapse, money drop, layoff, housing, plague, miracle, baby boom, strikes, chaos/blessing, extinction) with icons, severity, configure → dramatic confirm modals.

## 33–37. Command, search, tooltips, menus, follow

`CTRL+K` fuzzy command palette (people, places, actions, views) with keyboard nav. Global search across citizens/businesses/buildings/events/news/roles. Polished tooltips (no native titles). Right-click menus (inspect, follow, talk, admin, relations, history, teleport). Follow mode: tracking camera + cinematic HUD card + stop button, UI minimised. Optional fullscreen CINEMATIC MODE (time/speed/selection/major events only).

## 38–40. Districts & layers

Named districts on distant zoom; layer switcher (NORMAL/WEALTH/HAPPINESS/CRIME/UNEMPLOYMENT/PROPERTY/BUSINESS/POPULATION/RELATIONS/AI/HEALTH) with smooth overlays + legend.

## 41–47. Motion, sound, states, modals, toasts

Framer Motion-grade transitions (panels, focus, tabs, notifications, numbers, dialogue, hover, graphs) at 60fps, restrained. Microinteractions (hover glow, money ticks, bankruptcy pulse, AI ring, selection ripple, event accents). Optional muted-by-default UI sounds. Polished skeletons (RESTORING CIVILISATION…), context-aware empty states, redesigned modals (dark + red danger variants), grouped toast system (success/info/warning/critical/admin/AI).

## 48–56. Layout, components, perf, access

Ultrawide-first (1920→3440; map takes extra width, persistent inspector/feed) without breaking 1366×768. Reusable primitives (Panel, MetricCard, Avatar, Sparkline, Drawer, Modal, Palette, Tooltip, Event/Business/Citizen cards, DangerButton…). Map LOD (districts → points → avatars), virtualised lists, memo/canvas/throttle/batched WS/rAF. Keyboard, contrast, focus, reduced-motion support. Smooth cross-module transitions preserving selection. Dev-only component playground.

## 57–65. People, pulse, stories, moments, trees, modes

People directory (search/filter, grid/table/graph, rich cards). WORLD PULSE auto-summaries (economy, population, crime, AI, hiring, housing). CITY STORIES derived from state/events (entrepreneurs, crises, climbers) — browsable, never invented. Cinematic moment cards (birth, marriage, death, founding, wins, arrests), meaningful death pages (dates, roles, family, View Life/tree), interactive family trees, per-citizen history archives. UI states NORMAL/PAUSED/FAST/GOD/CINEMATIC/DEBUG visually distinct. Sections/drawers/overlays over card-soup.

## 66–73. Landing, creation, HUD, cleanup

Atmospheric launch screen (world cards with pop/year/last-played, CONTINUE/NEW/LOAD/LAB/SETTINGS, AI status). Exciting world-creation (city, seed, population, economy, crime, AI, wealth, government, complexity + perf estimate + generation progress). Debug-only perf HUD. Remove prototype aesthetics (tiny buttons, raw tabs, grid map, square buildings, dot citizens, text inspector, terminal look) — prototype may survive under a dev route only. Themed animated charts, never rainbow.

## 74–77. Priority, life, routes, buildings, pins, notifications

Hierarchy: CITY > PEOPLE > EVENTS > STATE > CONTEXT > NAV. Life signals always visible: movement, open/close, lights, trickling events, advancing time, AI flashes, money shifts. Selection shows route + destination + ETA. Building inspector (owner, open/closed, occupants/workers/capacity, financials, events, mini avatars). Pinnable entities. Configurable notification centre.

## 78–84. Quality, phases, data, errors, bar

Every screen answers: what/​happening/important/interactive? Phases: A shell/theme/nav → B map/camera/entities/lighting → C citizens/people/graphs/family → D business/economy/gov/data → E news/social/history/stories → F AI Brain → G God Console → H cinematic/polish/perf. Keep every existing control working (time, save, selection, AI debug, god actions, events, business, news, social, history). Real data everywhere; explicit disabled states otherwise. Error boundaries per module. Bar: *"Would this screenshot impress with no explanation?"* 2560×1440 CITY test (living map, movement, buildings, districts, date, stats, controls, events, selection, nav, no waste) + 3440 stretch test. Chrome/Edge, no overflow/clipping/scrollbars/jumps.

Deliverable: implemented, running, build-clean, WS-verified across routes, time/citizens/selection/AI/god all live-tested. Make the sim FEEL REAL — zoom in, find Marcus furious at work, trace his hatred for his manager, watch cognition fire, fast-forward six months to his startup covered in the Times, then drop £5M on him from God Console just to watch what happens. Keep the logic. Replace the experience.
