// BUSINESSES / ECONOMY / GOVERNMENT / DATA — real charts from /api/metrics,
// buildings-derived firms, admin-backed ledgers where the token allows.
import React, { useEffect, useMemo, useState } from 'react';
import { api, type Metrics } from '../api';
import { useEcho } from '../store';
import { Avatar, Chart, DisabledBtn, Empty, MetricCard, Panel, Segmented } from '../primitives';
import { adminApi, hasOwnerToken } from '../admin/adminApi';

type MKey = 'population' | 'wealth' | 'gdp' | 'unemployment' | 'crime' | 'happiness' | 'inequality';
const MKEYS: MKey[] = ['population', 'wealth', 'gdp', 'unemployment', 'crime', 'happiness', 'inequality'];
const MCOLOR: Record<MKey, string> = {
  population: '#258b80', wealth: '#c89a51', gdp: '#dc7a5f', unemployment: '#b78a48',
  crime: '#b86351', happiness: '#87a794', inequality: '#ad7b8a',
};

function useMetrics() {
  const e = useEcho();
  return e.metrics;
}

function eventMarkers(days: number[], events: Array<{ day: number; text: string }>) {
  return events
    .map((ev) => ({ i: days.indexOf(ev.day), label: ev.text.slice(0, 40) }))
    .filter((m) => m.i >= 0)
    .slice(-8)
    .map((m) => ({ ...m, color: '#c89a51' }));
}

function MetricChart({ k, metrics, days }: { k: MKey; metrics: Metrics[]; days: number[] }) {
  const e = useEcho();
  const data = metrics.map((m) => Number(m[k] ?? 0));
  if (data.length < 2) return <div className="faint">Collecting {k}… (needs 2+ days)</div>;
  const markers = eventMarkers(days, e.events.filter((ev) => /crash|boom|recession|election|outbreak|law|nuke|crisis/i.test(ev.text)));
  return <Chart data={data} labels={days.map((d) => `day ${d}`)} color={MCOLOR[k]} markers={markers} yLabel={k} height={140} />;
}

/* ================= BUSINESSES ================= */
export function BusinessView() {
  const e = useEcho();
  const [q, setQ] = useState('');
  const [adm, setAdm] = useState<Array<Record<string, unknown>> | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!hasOwnerToken()) return;
    adminApi.businesses().then((b) => setAdm(b)).catch(() => setAdm(null));
  }, []);

  const firms = useMemo(() => {
    if (adm && adm.length) return adm.filter((b) => !q || String(b.name ?? b.id).toLowerCase().includes(q.toLowerCase())).map((b) => ({
      id: String(b.id), name: String(b.name ?? b.id), type: String(b.type ?? 'business'),
      funds: Number(b.funds ?? 0), ownerId: b.ownerId ? String(b.ownerId) : null,
      x: Number(b.x ?? 500), y: Number(b.y ?? 500), src: 'ledger' as const,
    }));
    // Derive firms from real buildings (honest fallback).
    return e.buildings
      .filter((b) => /shop|market|business|office|factor|commercial|hotel|bar|farm/i.test(b.type))
      .filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()))
      .map((b) => ({ id: b.id, name: b.name, type: b.type, funds: b.funds ?? 0, ownerId: b.ownerId ?? null, x: b.x, y: b.y, src: 'map' as const }));
  }, [adm, e.buildings, q]);

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of e.citizens) m.set(c.id, c.name);
    return m;
  }, [e.citizens]);

  const spawn = async () => {
    if (!hasOwnerToken()) { setMsg('God Key required (ledger is OWNER-only).'); return; }
    try { await adminApi.bizSpawn({ name: `Firm ${Date.now() % 10000}` }); setMsg('spawned ✓'); adminApi.businesses().then(setAdm).catch(() => {}); }
    catch (err) { setMsg(String(err instanceof Error ? err.message : err)); }
  };

  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">Work & enterprise</span><h1>Businesses</h1><p className="view-summary">Meet the places where Echo City earns a living.</p><div className="view-statline"><span>{firms.length} firms</span><span>{adm ? 'Owner ledger' : 'City map registry'}</span></div></div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Search firms…" style={{ maxWidth: 260 }} />
        <button onClick={spawn}>+ Found firm</button>
        <DisabledBtn label="Export registry" />
        {msg && <span className="dim">{msg}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
        {firms.map((f) => (
          <Panel key={f.id} title={f.name} icon="shop">
            <div className="kv"><span>sector</span><b>{f.type}</b><span>funds</span><b className="mono">${Math.round(f.funds).toLocaleString()}</b>
              <span>owner</span><b>{f.ownerId ? (owners.get(f.ownerId) ?? f.ownerId.slice(0, 8)) : '—'}</b></div>
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => { e.setSelBuilding(e.buildings.some((b) => b.id === f.id) ? f.id : null); e.setView('city'); }}>Locate</button>
              {f.ownerId && <button onClick={() => { e.setSelCitizen(f.ownerId); e.setView('people'); }}>Owner</button>}
            </div>
          </Panel>
        ))}
      </div>
      {firms.length === 0 && <Empty icon="shop" text="No firms yet — found one to seed the economy." />}
    </div>
  );
}

/* ================= ECONOMY ================= */
export function EconomyView() {
  const e = useEcho();
  const m = useMetrics();
  const [money, setMoney] = useState<number | null>(null);
  const [focus, setFocus] = useState<MKey>('gdp');
  useEffect(() => {
    fetch('/api/money').then((r) => r.json()).then((j) => setMoney(Number(j.supply ?? j.money ?? NaN))).catch(() => setMoney(null));
  }, [e.state?.clock.day]);
  const last = m[m.length - 1];
  const prev = m[m.length - 2];
  const chg = (k: MKey): string => {
    if (!last || !prev) return '';
    const d = Number(last[k] ?? 0) - Number(prev[k] ?? 0);
    return `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}`;
  };
  const days = m.map((x) => x.day);
  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">The big picture</span><h1>How is the city doing?</h1><p className="view-summary">Follow output, opportunity and wealth as the city grows. Every reading comes from the simulation.</p><div className="view-statline"><span>{m.length} daily closes</span><span>Day {e.state?.clock.day ?? 1}</span></div></div>
      <div className="grid4" style={{ marginBottom: 10 }}>
        <MetricCard label="GDP" value={last ? Math.round(Number(last.gdp)).toLocaleString() : '—'} delta={chg('gdp')} icon="coin" color="#dc7a5f" />
        <MetricCard label="Money supply" value={money != null && !Number.isNaN(money) ? '$' + Math.round(money).toLocaleString() : '—'} icon="db" color="#c89a51" sub={money == null ? 'Money data unavailable' : undefined} />
        <MetricCard label="Unemployment" value={last ? Number(last.unemployment).toFixed(1) + '%' : '—'} delta={chg('unemployment')} icon="users" color="#b78a48" />
        <MetricCard label="Inequality" value={last ? Number(last.inequality).toFixed(2) : '—'} delta={chg('inequality')} icon="scale" color="#ad7b8a" />
      </div>
      <Panel title="Daily trends" icon="chart">
        <p className="dim" style={{ margin: '0 0 14px', fontSize: 13 }}>Explore {focus} over time. Hover for values; ◆ marks major events.</p>
        <div style={{ maxWidth: '100%', overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
          <Segmented<MKey> value={focus} onChange={setFocus} options={MKEYS.map((k) => ({ v: k, label: k }))} />
        </div>
        <MetricChart k={focus} metrics={m} days={days} />
      </Panel>
      <div className="grid3" style={{ marginTop: 10 }}>
        {MKEYS.filter((k) => k !== focus).map((k) => (
          <Panel key={k} title={k} icon="chart">
            <div className="row">
              <div style={{ flex: 1 }}><MetricChart k={k} metrics={m} days={days} /></div>
            </div>
            <div className="mono dim">now: {last ? Number(last[k]).toFixed(1) : '—'}</div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ================= GOVERNMENT ================= */
export function GovView() {
  const e = useEcho();
  const [gov, setGov] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState('');
  const authed = hasOwnerToken();
  useEffect(() => {
    if (!authed) return;
    adminApi.government().then(setGov).catch(() => setGov(null));
  }, [authed, e.state?.clock.day]);
  const laws = e.events.filter((x) => /law|decree|tax|election|mayor|arrest|release/i.test(x.text)).slice(-12).reverse();

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg(ok); adminApi.government().then(setGov).catch(() => {}); }
    catch (err) { setMsg(String(err instanceof Error ? err.message : err)); }
  };

  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">Civic life</span><h1>Government</h1><p className="view-summary">Follow the decisions, laws and institutions shaping daily life.</p><div className="view-statline"><span>{authed && gov ? 'Cabinet ledger available' : 'Public record'}</span><span>{laws.length} recent civic events</span></div></div>
      {!authed && <div className="ev-card" style={{ borderLeftColor: '#c89a51' }}>The public record is open. Add your owner key in the top bar to manage the cabinet ledger.</div>}
      {gov && (
        <Panel title="Cabinet ledger" icon="gov">
          <div className="kv">
            {Object.entries(gov).slice(0, 10).map(([k, v]) => (
              <React.Fragment key={k}><span>{k}</span><b className="mono">{typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v)}</b></React.Fragment>
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button onClick={() => { const t = prompt('tax rate 0..1', '0.15'); if (t) act(() => adminApi.govSet({ taxRate: Number(t) }), 'tax set ✓'); }}>Set tax</button>
            <button onClick={() => { const t = prompt('decree law text'); if (t) act(() => adminApi.law(t), 'law decreed ✓'); }}>Decree law</button>
            <button onClick={() => act(() => adminApi.election(), 'election held ✓')}>Snap election</button>
            <button onClick={() => { const id = prompt('arrest citizen id'); if (id) act(() => adminApi.arrest(id), 'arrested ✓'); }}>Arrest…</button>
            <button onClick={() => { const id = prompt('release citizen id'); if (id) act(() => adminApi.release(id), 'released ✓'); }}>Release…</button>
            {msg && <span className="dim">{msg}</span>}
          </div>
        </Panel>
      )}
      <div className="grid2" style={{ marginTop: 10 }}>
        <Panel title="Laws & order (from events)" icon="scale">
          {laws.length === 0 && <div className="faint">No decrees, elections or arrests on record.</div>}
          {laws.map((l) => <div key={l.id} className="ev-card" style={{ borderLeftColor: '#c89a51' }}><div className="meta">DAY {l.day} · {l.type}</div>{l.text}</div>)}
        </Panel>
        <Panel title="Safety" icon="shield">
          <div className="kv"><span>city crime</span><b className="mono">{e.derived.crime.toFixed(1)}</b>
            <span>incarcerated</span><b>{e.citizens.filter((c) => /jail|prison|arrest/i.test(c.activity ?? '')).length}</b>
            <span>avg health</span><b>{(e.citizens.reduce((a, c) => a + (c.health ?? 0), 0) / Math.max(1, e.citizens.length)).toFixed(0)}</b></div>
          <div className="sec-h">Behind bars</div>
          {e.citizens.filter((c) => /jail|prison|arrest/i.test(c.activity ?? '')).slice(0, 6).map((c) => (
            <div key={c.id} className="list-row" onClick={() => { e.setSelCitizen(c.id); e.setView('people'); }}>
              <Avatar seed={c.id} name={c.name} size={24} /><span>{c.name}</span><span style={{ flex: 1 }} /><span className="faint">{c.activity}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ================= DATA ================= */
export function DataView() {
  const m = useMetrics();
  const e = useEcho();
  const [k, setK] = useState<MKey>('population');
  const days = m.map((x) => x.day);
  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">City observatory</span><h1>Explore the data.</h1><p className="view-summary">See how each part of the city changes over time. Hover charts for exact values.</p><div className="view-statline"><span>{m.length} daily closes</span><span>◆ marks major events</span></div></div>
      <Panel title="Metric explorer" icon="db">
        <div style={{ maxWidth: '100%', overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
          <Segmented<MKey> value={k} onChange={setK} options={MKEYS.map((x) => ({ v: x, label: x }))} />
        </div>
        <MetricChart k={k} metrics={m} days={days} />
      </Panel>
      <Panel title="Daily closes" icon="chart" raised>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }} className="mono">
            <thead><tr className="faint">{['day', ...MKEYS].map((h) => <th key={h} style={{ textAlign: 'right', padding: '4px 8px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {[...m].slice(-20).reverse().map((r) => (
                <tr key={r.day} style={{ borderTop: '1px solid #e6e3da' }}>
                  <td style={{ textAlign: 'right', padding: '4px 8px' }}>{r.day}</td>
                  {MKEYS.map((kk) => <td key={kk} style={{ textAlign: 'right', padding: '4px 8px', color: MCOLOR[kk] }}>{Number(r[kk]).toFixed(1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {m.length === 0 && <div className="faint">No closes yet — run the sim.</div>}
      </Panel>
      <Panel title="Debug / tick" icon="gear">
        <DebugBlock />
        <div className="row" style={{ marginTop: 6 }}><DisabledBtn label="Export CSV" /></div>
      </Panel>
    </div>
  );
}

function DebugBlock() {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { api.debug().then(setD).catch(() => setD(null)); }, []);
  if (!d) return <div className="faint">debug offline</div>;
  return <pre className="mono faint" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify(d, null, 1).slice(0, 1500)}</pre>;
}
