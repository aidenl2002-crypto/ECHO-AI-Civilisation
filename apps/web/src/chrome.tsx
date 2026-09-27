// ECHO OS chrome: top bar, nav rail, right context panel, event strip,
// command palette, start screen, toasts.
import React, { useEffect, useMemo, useState } from 'react';
import { api, type CitizenDetail } from './api';
import { useEcho, type View } from './store';
import { Icon } from './icons';
import { Avatar } from './primitives';
import { getOwnerToken, setOwnerToken } from './admin/adminApi';

const SPEEDS = [1, 2, 5, 10, 50, 100];
const SEASONS: Record<string, string> = { spring: '🌱', summer: '☀️', autumn: '🍂', fall: '🍂', winter: '❄️' };
const jobLabel = (job: string): string => /^j_(?:extra_|\d)/.test(job) ? 'City worker' : job.replace(/^j_/, '').replace(/[_-]/g, ' ');

function fmtClock(s: { year: number; day: number; hour: number; season: string } | null | undefined): string {
  if (!s) return '—';
  return `${SEASONS[(s.season || '').toLowerCase()] ?? '☀️'} ${s.season} · Year ${s.year}, day ${s.day} · ${String(s.hour).padStart(2, '0')}:00`;
}

export function TopBar() {
  const e = useEcho();
  const s = e.state;
  const [godKey, setGodKey] = useState(getOwnerToken());
  useEffect(() => {
    const sync = (): void => setGodKey(getOwnerToken());
    window.addEventListener('echo-owner-token-change', sync);
    return () => window.removeEventListener('echo-owner-token-change', sync);
  }, []);
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Icon name="city" size={21} /></span><div className="brand-copy"><span className="city">Echo</span><small>A living city</small></div></div>
      <div className="world-time"><span className="city-name">{s?.cityName ?? 'Echo City'}</span><span className="clock">{fmtClock(s?.clock ?? null)}{s?.paused ? ' · Paused' : ''}</span></div>
      {!e.online && <span className="reconnect">RECONNECTING…</span>}
      <div className="stats">
        <span className="tstat"><Icon name="users" size={13} /> <b>{e.derived.pop}</b> people</span>
        <span className="tstat"><Icon name="heart" size={13} /> <b>{e.derived.happiness.toFixed(0)}</b> mood</span>
        <span className="tstat"><Icon name="coin" size={13} /> <b>{e.derived.gdp.toFixed(0)}</b> GDP</span>
        <span className="tstat"><Icon name="chart" size={13} /> <b>{e.derived.unemployment.toFixed(1)}%</b> unemp.</span>
        <span className="tstat"><Icon name="shield" size={13} /> <b>{e.derived.crime.toFixed(1)}</b> crime</span>
        <span className="tstat" title="AI thoughts this session"><Icon name="brain" size={13} /> <b>{e.derived.aiThoughts}</b> thoughts</span>
      </div>
      <span className="spacer" />
      <div className="top-actions">
      <div className="speeds">
        <button className="ghost" title="Pause / resume (Space)" onClick={() => e.setPaused(!(s?.paused ?? false))}>
          <Icon name={s?.paused ? 'play' : 'pause'} size={14} />
        </button>
        {SPEEDS.map((x) => <button key={x} className={s?.speed === x ? 'active' : ''} onClick={() => e.setSpeed(x)}>{x}x</button>)}
        <button className={s?.speed === 500 ? 'active' : ''} title="MAX speed" onClick={() => e.setSpeed(500)}>MAX</button>
        <button title="Step one tick" onClick={e.step}><Icon name="step" size={13} /></button>
      </div>
      <button title="Save city" onClick={e.save}><Icon name="save" size={14} /></button>
      <button className="ghost danger" title="Save & exit (saves current world, then closes this tab)" onClick={async () => { await e.save(); window.close(); }}><Icon name="power" size={14} /></button>
      <button className="ghost" title="AI Brain" onClick={() => e.setView('brain')}><Icon name="gear" size={16} /></button>
      <input className="owner-key" value={godKey} onChange={(ev) => { setGodKey(ev.target.value); setOwnerToken(ev.target.value); }}
        placeholder="Owner key" type="password" title="Owner key (stored locally)" />
      </div>
    </header>
  );
}

const NAV: Array<{ v: View; label: string; icon: string; cls: string; hot: string }> = [
  { v: 'city', label: 'City', icon: 'city', cls: 'c-city', hot: '1' },
  { v: 'people', label: 'People', icon: 'users', cls: 'c-people', hot: '2' },
  { v: 'business', label: 'Businesses', icon: 'shop', cls: 'c-business', hot: '3' },
  { v: 'economy', label: 'Economy', icon: 'coin', cls: 'c-business', hot: '4' },
  { v: 'gov', label: 'Government', icon: 'gov', cls: 'c-gov', hot: '5' },
  { v: 'social', label: 'Social', icon: 'msg', cls: 'c-social', hot: '6' },
  { v: 'news', label: 'News', icon: 'news', cls: 'c-social', hot: '7' },
  { v: 'history', label: 'History', icon: 'clock', cls: 'c-social', hot: '8' },
  { v: 'data', label: 'Data', icon: 'db', cls: 'c-ai', hot: '9' },
  { v: 'brain', label: 'AI Brain', icon: 'brain', cls: 'c-ai', hot: '' },
  { v: 'god', label: 'God Console', icon: 'skull', cls: 'c-god', hot: '' },
];

export function LeftRail() {
  const e = useEcho();
  const [mini, setMini] = useState(false);
  return (
    <nav className={mini ? 'rail mini' : 'rail'}>
      <div className="rail-caption">EXPLORE THE CITY</div>
      <div className="sect">World</div>
      {NAV.slice(0, 5).map((n) => (
        <button key={n.v} className={e.view === n.v ? `nav active ${n.cls}` : 'nav'} onClick={() => e.setView(n.v)} title={`${n.label}${n.hot ? ` (${n.hot})` : ''}`}>
          <Icon name={n.icon} size={16} /><span className="lbl">{n.label}</span>
        </button>
      ))}
      <div className="sect">Story</div>
      {NAV.slice(5, 9).map((n) => (
        <button key={n.v} className={e.view === n.v ? `nav active ${n.cls}` : 'nav'} onClick={() => e.setView(n.v)} title={n.label}>
          <Icon name={n.icon} size={16} /><span className="lbl">{n.label}</span>
        </button>
      ))}
      <div className="sect">More</div>
      {NAV.slice(9).map((n) => (
        <button key={n.v} className={e.view === n.v ? `nav active ${n.cls}` : 'nav'} onClick={() => e.setView(n.v)} title={n.label}>
          <Icon name={n.icon} size={16} /><span className="lbl">{n.label}</span>
        </button>
      ))}
      <span style={{ flex: 1 }} />
      <button className="nav" onClick={() => e.setPaletteOpen(true)} title="Command palette (Ctrl+K)">
        <Icon name="search" size={16} /><span className="lbl">Quick search</span>
      </button>
      <button className="nav" onClick={() => setMini((m) => !m)} title="Collapse rail">
        <Icon name="menu" size={16} /><span className="lbl">{mini ? 'Expand' : 'Collapse'}</span>
      </button>
    </nav>
  );
}

export function RightPanel() {
  const e = useEcho();
  const sel = e.citizens.find((c) => c.id === e.selCitizen) ?? null;
  const bld = e.buildings.find((b) => b.id === e.selBuilding) ?? null;
  return (
    <aside className="right">
      <div className="rhead">
        <Icon name={bld && !sel ? 'shop' : 'eye'} size={14} />
        {sel ? 'Resident' : bld ? 'Building' : 'Around the city'}
        <span style={{ flex: 1 }} />
        {(sel || bld) && <button className="ghost" onClick={() => { e.setSelCitizen(null); e.setSelBuilding(null); }}><Icon name="x" size={13} /></button>}
      </div>
      <div className="rbody">
        {sel ? <MiniCitizen id={sel.id} name={sel.name} /> : bld ? <MiniBuilding /> : <WorldPulse />}
      </div>
    </aside>
  );
}

function MiniCitizen({ id, name }: { id: string; name: string }) {
  const e = useEcho();
  const [d, setD] = useState<CitizenDetail | null>(null);
  React.useEffect(() => {
    let live = true;
    api.citizen(id).then((x) => { if (live) setD(x); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [id]);
  if (!d) return <div className="dim">Loading {name}…</div>;
  return (
    <div>
      <div className="row">
        <Avatar seed={d.id} name={d.name} size={44} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
          <div className="dim" style={{ fontSize: 11.5 }}>{d.age}y · {jobLabel(d.job)} · <span className="mono">{d.id.slice(0, 8)}</span></div>
        </div>
      </div>
      <div className="grid3" style={{ marginTop: 10 }}>
        <div className="metric"><div className="k">Health</div><div className="v" style={{ color: d.health > 60 ? '#34d399' : d.health > 30 ? '#fbbf24' : '#f87171' }}>{Math.round(d.health)}</div></div>
        <div className="metric"><div className="k">Mood</div><div className="v" style={{ color: d.mood > 60 ? '#34d399' : d.mood > 30 ? '#fbbf24' : '#f87171' }}>{Math.round(d.mood)}</div></div>
        <div className="metric"><div className="k">Wealth</div><div className="v">${Math.round(d.wealth).toLocaleString()}</div></div>
      </div>
      <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Doing: <b style={{ color: 'var(--txt)' }}>{d.activity ?? '—'}</b> · Home: {d.home ?? '—'}</div>
      <div className="row wrap" style={{ marginTop: 10 }}>
        <button onClick={() => e.setView('people')}>Open profile</button>
        <button className={e.follow ? 'active' : ''} onClick={() => e.setFollow(!e.follow)} title="Follow (F)">
          <Icon name="eye" size={13} /> {e.follow ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  );
}

function MiniBuilding() {
  const e = useEcho();
  const b = e.buildings.find((x) => x.id === e.selBuilding);
  if (!b) return null;
  const staff = e.citizens.filter((c) => (c.activity ?? '').includes(b.name.slice(0, 8))).slice(0, 5);
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
      <div className="dim" style={{ fontSize: 12 }}><span className="chip">{b.type}</span> <span className="mono">{b.id.slice(0, 8)}</span></div>
      <div className="kv" style={{ marginTop: 8 }}>
        <span>position</span><b className="mono">{Math.round(b.x)}, {Math.round(b.y)}</b>
        <span>funds</span><b>{b.funds != null ? '$' + Math.round(b.funds).toLocaleString() : '—'}</b>
        <span>owner</span><b className="mono">{b.ownerId?.slice(0, 8) ?? '—'}</b>
      </div>
      <div className="sec-h">Present ({staff.length})</div>
      {staff.length === 0 && <div className="faint" style={{ fontSize: 12 }}>Nobody here right now.</div>}
      {staff.map((c) => (
        <div key={c.id} className="list-row" onClick={() => { e.setSelCitizen(c.id); e.setView('people'); }}>
          <Avatar seed={c.id} name={c.name} size={24} /><span>{c.name}</span>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={() => e.setView('business')}>Businesses</button>
      </div>
    </div>
  );
}

function WorldPulse() {
  const e = useEcho();
  const pulse = useMemo(() => {
    const alive = e.citizens.filter((c) => c.alive !== false);
    const avg = (f: (c: (typeof alive)[0]) => number) => alive.length ? alive.reduce((a, c) => a + f(c), 0) / alive.length : 0;
    const jobs = new Map<string, number>();
    for (const c of alive) { const label = jobLabel(c.job); jobs.set(label, (jobs.get(label) ?? 0) + 1); }
    const topJobs = [...jobs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const acts = new Map<string, number>();
    for (const c of alive) if (c.activity) acts.set(c.activity, (acts.get(c.activity) ?? 0) + 1);
    const topActs = [...acts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { avgMood: avg((c) => c.mood ?? 50), avgHealth: avg((c) => c.health ?? 80), topJobs, topActs, rich: [...alive].sort((a, b) => b.wealth - a.wealth)[0] };
  }, [e.citizens]);
  const stories = useMemo(() => {
    // CITY STORIES: derived only from live state + events (never fabricated).
    const out: Array<{ text: string; color: string }> = [];
    for (const ev of e.events.slice(-30).reverse()) {
      if (/birth|born|wedding|marri|died|death|arrest|found|elect|fire|outbreak|crash|boom/i.test(ev.text)) {
        out.push({ text: ev.text, color: '#e8b93e' });
        if (out.length >= 3) break;
      }
    }
    return out;
  }, [e.events]);
  return (
    <div>
      <div className="sec-h" style={{ marginTop: 0 }}>How things are going</div>
      <div className="grid2">
        <div className="metric"><div className="k">Avg mood</div><div className="v">{pulse.avgMood.toFixed(0)}</div></div>
        <div className="metric"><div className="k">Avg health</div><div className="v">{pulse.avgHealth.toFixed(0)}</div></div>
      </div>
      <div className="sec-h">Top jobs</div>
      {pulse.topJobs.map(([j, n]) => <div key={j} className="row" style={{ fontSize: 12 }}><span>{j}</span><span style={{ flex: 1 }} /><b className="mono">{n}</b></div>)}
      <div className="sec-h">Right now</div>
      {pulse.topActs.map(([a, n]) => <div key={a} className="row" style={{ fontSize: 12 }}><span>{a}</span><span style={{ flex: 1 }} /><b className="mono">{n}</b></div>)}
      {pulse.rich && <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Highest balance: <b style={{ color: 'var(--txt)' }}>{pulse.rich.name}</b> (${Math.round(pulse.rich.wealth).toLocaleString()})</div>}
      <div className="sec-h">City stories</div>
      {stories.length === 0 && <div className="faint" style={{ fontSize: 12 }}>The city is quiet. Stories appear as citizens live.</div>}
      {stories.map((s, i) => <div key={i} className="ev-card" style={{ borderLeftColor: s.color }}>{s.text}</div>)}
      <div className="sec-h">Latest events</div>
      {[...e.events].slice(-6).reverse().map((ev) => (
        <div key={ev.id} className="ev-chip" style={{ marginBottom: 5 }} onClick={() => e.setView('history')}>
          <span className="t">D{ev.day}</span><span>{ev.text.slice(0, 64)}</span>
        </div>
      ))}
    </div>
  );
}

export function BottomStrip() {
  const e = useEcho();
  const evs = [...e.events].slice(-14).reverse();
  return (
    <div className="timestrip">
      <span className="timestrip-label">Happening now</span>
      {evs.map((ev) => (
        <span key={ev.id} className="ev-chip" onClick={() => e.setView('history')} title={ev.text}>
          <span className="t">D{ev.day} {ev.type}</span><span>{ev.text.slice(0, 70)}</span>
        </span>
      ))}
      {evs.length === 0 && <span className="faint">The city is waking up. Its stories will appear here.</span>}
    </div>
  );
}

export function Toasts() {
  const e = useEcho();
  return (
    <div className="toasts">
      {e.toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

export function CommandPalette() {
  const e = useEcho();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (e.paletteOpen) {
      setQ(''); setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [e.paletteOpen]);
  if (!e.paletteOpen) return null;
  const cmds: Array<{ label: string; hint: string; run: () => void }> = [
    ...NAV.map((n) => ({ label: `Go to ${n.label}`, hint: 'view', run: () => e.setView(n.v) })),
    { label: e.state?.paused ? 'Resume simulation' : 'Pause simulation', hint: 'time', run: () => e.setPaused(!(e.state?.paused ?? false)) },
    { label: 'Step one tick', hint: 'time', run: () => e.step() },
    { label: 'Save civilisation', hint: 'time', run: () => e.save() },
    { label: 'Toggle follow', hint: 'map', run: () => e.setFollow(!e.follow) },
    { label: 'Toggle cinematic mode', hint: 'map', run: () => e.setCinematic(!e.cinematic) },
    { label: 'Toggle observer mode', hint: 'map', run: () => e.setObserver(!e.observer) },
    ...e.citizens.filter((c) => q && c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6).map((c) => ({
      label: `Inspect ${c.name} (${c.job})`, hint: 'citizen',
      run: () => { e.setSelCitizen(c.id); e.setView('people'); },
    })),
  ];
  const shown = cmds.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <div className="palette-back" onClick={() => e.setPaletteOpen(false)}>
      <div className="palette" onClick={(x) => x.stopPropagation()}>
        <input ref={inputRef} autoFocus value={q} placeholder="Type a command or search citizens…" onChange={(x) => { setQ(x.target.value); setSel(0); }}
          onKeyDown={(x) => {
            if (x.key === 'ArrowDown') { x.preventDefault(); setSel((s) => Math.min(shown.length - 1, s + 1)); }
            if (x.key === 'ArrowUp') { x.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (x.key === 'Enter' && shown[sel]) { shown[sel].run(); e.setPaletteOpen(false); }
          }} />
        {shown.map((c, i) => (
          <div key={i} className={i === sel ? 'pal-item sel' : 'pal-item'}
            onMouseEnter={() => setSel(i)}
            onClick={() => { c.run(); e.setPaletteOpen(false); }}>
            <Icon name="cmd" size={13} /><span>{c.label}</span><span style={{ flex: 1 }} /><span className="faint">{c.hint}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="dim" style={{ padding: 14 }}>No match.</div>}
      </div>
    </div>
  );
}

export function StartScreen() {
  const e = useEcho();
  const [seed, setSeed] = useState('echo-1');
  const [cityName, setCityName] = useState('Echo City');
  const [pop, setPop] = useState(120);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg('');
    try { await fn(); e.start(); e.refresh(); }
    catch (err) { setMsg(`Failed: ${err instanceof Error ? err.message : err} — is the API on :4000?`); }
    setBusy(false);
  };
  return (
    <div className="start-wrap">
      <div className="start-intro">
        <div className="start-eyebrow">A WORLD WITH A LIFE OF ITS OWN</div>
        <h1>Every city has a <em>story.</em></h1>
        <p>Meet the people of Echo. Watch them find work, build relationships, make decisions and shape the place they call home.</p>
        <div className="start-illustration" aria-hidden="true" />
      </div>
      <div className="start-card">
        <h2>Start your city</h2>
        <div className="sub">Set the scene, then see where life takes it.</div>
        <div style={{ display: 'grid', gap: 15, textAlign: 'left', marginBottom: 22 }}>
          <label>City name<input value={cityName} onChange={(x) => setCityName(x.target.value)} /></label>
          <label>Starting population<input type="number" min={5} max={1000} value={pop} onChange={(x) => setPop(Number(x.target.value))} /></label>
          <label>World seed<input value={seed} onChange={(x) => setSeed(x.target.value)} /></label>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="big-btn" disabled={busy} onClick={() => go(() => api.newGame(seed, cityName, pop))}>{busy ? 'Starting…' : 'Create city →'}</button>
          <div className="row">
            <button style={{ flex: 1 }} disabled={busy} onClick={() => go(() => api.load('autosave'))}>Continue saved city</button>
            <button style={{ flex: 1 }} disabled={busy} onClick={() => { const s = prompt('Save slot?', 'autosave') ?? 'autosave'; return go(() => api.load(s)); }}>Load another…</button>
          </div>
        </div>
        {msg && <p style={{ color: 'var(--red)' }}>{msg}</p>}
        <p className="start-footnote">A little world, ready to grow. You can pause time or explore any resident once you enter.</p>
      </div>
    </div>
  );
}
