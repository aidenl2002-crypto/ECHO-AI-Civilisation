// Global ECHO OS store: polling, selection, toasts, palette, derived metrics.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Building, type CitizenSummary, type CityLayout, type GameState, type Metrics, type SimEvent } from './api';

export type View = 'city' | 'people' | 'business' | 'economy' | 'gov' | 'social' | 'news' | 'history' | 'data' | 'brain' | 'god';

export interface Toast { id: number; text: string; kind: 'info' | 'ok' | 'err' }

interface EchoCtx {
  started: boolean; start: () => void;
  online: boolean;
  state: GameState | null; citizens: CitizenSummary[]; buildings: Building[];
  layout: CityLayout | null;
  events: SimEvent[]; metrics: Metrics[];
  view: View; setView: (v: View) => void;
  selCitizen: string | null; setSelCitizen: (id: string | null) => void;
  selBuilding: string | null; setSelBuilding: (id: string | null) => void;
  follow: boolean; setFollow: (b: boolean) => void;
  overlay: string; setOverlay: (s: string) => void;
  cinematic: boolean; setCinematic: (b: boolean) => void;
  observer: boolean; setObserver: (b: boolean) => void;
  toasts: Toast[]; push: (text: string, kind?: Toast['kind']) => void;
  paletteOpen: boolean; setPaletteOpen: (b: boolean) => void;
  refresh: () => void;
  setSpeed: (s: number) => void; setPaused: (p: boolean) => void; step: () => void; save: () => void;
  derived: { pop: number; happiness: number; gdp: number; unemployment: number; crime: number; wealth: number; aiThoughts: number };
  aiOnline: boolean;
}

const Ctx = createContext<EchoCtx | null>(null);

let toastId = 1;

export function EchoProvider({ children }: { children: React.ReactNode }) {
  const [started, setStarted] = useState(false);
  const [online, setOnline] = useState(true);
  const [state, setState] = useState<GameState | null>(null);
  const [citizens, setCitizens] = useState<CitizenSummary[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [layout, setLayout] = useState<CityLayout | null>(null);
  const layoutKey = useRef<string | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [view, setView] = useState<View>('city');
  const [selCitizen, setSelCitizen] = useState<string | null>(null);
  const [selBuilding, setSelBuilding] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [overlay, setOverlay] = useState('none');
  const [cinematic, setCinematic] = useState(false);
  const [observer, setObserver] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOnline, setAiOnline] = useState(false);
  const tick = useRef(0);

  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-4), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refresh = useCallback(async () => {
    const n = ++tick.current;
    try {
      const [s, c, b] = await Promise.all([api.state(), api.citizens(), api.buildings()]);
      if (n !== tick.current) return;
      // Geography is static within a world; avoid transferring it on each citizen poll.
      if (layoutKey.current !== (s.worldKey ?? s.seed ?? 'legacy')) {
        const geography = await api.layout();
        if (n !== tick.current) return;
        setLayout(geography); layoutKey.current = s.worldKey ?? s.seed ?? 'legacy';
      }
      setState(s); setCitizens(c); setBuildings(b);
      setOnline(true);
    } catch { if (n === tick.current) setOnline(false); }
  }, []);

  useEffect(() => {
    if (!started) return;
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [started, refresh]);

  useEffect(() => {
    if (!started) return;
    let live = true;
    const loadSlow = async () => {
      try {
        const [e, m, a] = await Promise.all([api.events(120), api.metrics(), api.aiStatus()]);
        if (!live) return;
        setEvents(e); setMetrics(m); setAiOnline(!!a?.enabled);
      } catch { /* keep stale */ }
    };
    loadSlow();
    const t = setInterval(loadSlow, 6000);
    return () => { live = false; clearInterval(t); };
  }, [started]);

  // Global hotkeys: Ctrl+K palette, 1..9 views, space pause, f follow, Esc close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((p) => !p); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const order: View[] = ['city', 'people', 'business', 'economy', 'gov', 'social', 'news', 'history', 'data', 'brain', 'god'];
      if (e.key >= '1' && e.key <= '9') setView(order[Number(e.key) - 1] ?? 'city');
      else if (e.key === ' ') { e.preventDefault(); if (state) api.pause(!state.paused).then(refresh).catch(() => {}); }
      else if (e.key.toLowerCase() === 'f') setFollow((f) => !f);
      else if (e.key === 'Escape') { setPaletteOpen(false); setCinematic(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [state, refresh]);

  const setSpeed = useCallback((s: number) => { api.speed(s).then(refresh).catch(() => push('speed failed — backend offline', 'err')); }, [refresh, push]);
  const setPaused = useCallback((p: boolean) => { api.pause(p).then(refresh).catch(() => push('pause failed — backend offline', 'err')); }, [refresh, push]);
  const step = useCallback(() => { api.step().then(refresh).catch(() => push('step failed', 'err')); }, [refresh, push]);
  const save = useCallback(() => { api.save().then(() => push('civilisation saved', 'ok')).catch(() => push('save failed', 'err')); }, [push]);

  const derived = useMemo(() => {
    const alive = citizens.filter((c) => c.alive !== false);
    const pop = alive.length || citizens.length;
    const happiness = alive.length ? alive.reduce((a, c) => a + (c.mood ?? 50), 0) / alive.length : 0;
    const wealth = citizens.reduce((a, c) => a + (c.wealth ?? 0), 0);
    const last = metrics[metrics.length - 1];
    return {
      pop,
      happiness: last?.happiness ?? happiness,
      gdp: last?.gdp ?? 0,
      unemployment: last?.unemployment ?? 0,
      crime: last?.crime ?? 0,
      wealth,
      aiThoughts: state?.counts?.thoughts ?? 0,
    };
  }, [citizens, metrics, state]);

  const v = useMemo<EchoCtx>(() => ({
    started, start: () => setStarted(true), online, state, citizens, buildings, layout, events, metrics,
    view, setView, selCitizen, setSelCitizen, selBuilding, setSelBuilding, follow, setFollow,
    overlay, setOverlay, cinematic, setCinematic, observer, setObserver,
    toasts, push, paletteOpen, setPaletteOpen, refresh,
    setSpeed, setPaused, step, save, derived, aiOnline,
  }), [started, online, state, citizens, buildings, layout, events, metrics, view, selCitizen, selBuilding, follow, overlay, cinematic, observer, toasts, push, paletteOpen, refresh, setSpeed, setPaused, step, save, derived, aiOnline]);

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useEcho(): EchoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEcho outside provider');
  return c;
}
