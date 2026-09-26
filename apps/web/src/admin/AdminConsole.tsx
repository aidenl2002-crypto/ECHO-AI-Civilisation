// AdminConsole — OWNER GOD CONSOLE: sidebar sections + telemetry rail + palettes.
import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, useToasts } from './adminApi';
import CitizenProfile from './CitizenProfile';
import CommandPalette from './CommandPalette';

type Section = 'World' | 'Citizens' | 'Businesses' | 'Economy' | 'Government' | 'Relationships' | 'Events' | 'Chaos Lab' | 'AI Brain' | 'Map Tools' | 'Time' | 'Database' | 'System' | 'Audit';
const SECTION_GROUPS: { label: string; sections: Section[] }[] = [
  { label: 'Overview', sections: ['World', 'Citizens', 'Businesses', 'Economy', 'Government', 'Relationships', 'Events'] },
  { label: 'Experiment', sections: ['Chaos Lab', 'AI Brain', 'Map Tools', 'Time'] },
  { label: 'Records', sections: ['Database', 'System', 'Audit'] },
];

function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    const tick = (): void => { fn().then((r) => live && setV(r)).catch(() => {}); };
    tick();
    const t = setInterval(tick, ms);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export default function AdminConsole() {
  const [sec, setSec] = useState<Section>('Citizens');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('wealth');
  const [sel, setSel] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [watch, setWatch] = useState<string[]>(() => JSON.parse(localStorage.getItem('echo_watch') ?? '[]'));
  const [overlay, setOverlay] = useState('wealth');
  const [experiment, setExperiment] = useState(false);
  const { toasts, push } = useToasts();

  const refreshCitizens = useCallback(() => adminApi.citizens(q, sort), [q, sort]);
  const citizens = usePoll(refreshCitizens, 3000, [q, sort]);
  const sys = usePoll(() => adminApi.system(), 3000);
  const events = usePoll(() => fetch('/api/events?limit=30').then((r) => r.json()), 4000);
  const heat = usePoll(() => fetch('/api/brain/heatmap').then((r) => r.json().catch(() => [])), 8000);

  useEffect(() => {
    localStorage.setItem('echo_watch', JSON.stringify(watch));
  }, [watch]);
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === '?' && (e.target as HTMLElement)?.tagName !== 'INPUT') push('Hotkeys: Ctrl+K command, g+c citizens, g+a audit, g+t time');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [push]);

  const confirmExtinct = async (): Promise<void> => {
    const c = prompt('Type EXTINCTION to arm MASS EXTINCTION');
    if (c !== 'EXTINCTION') { push('aborted'); return; }
    try { const r = await adminApi.extinction({ confirm: 'EXTINCTION' }) as { killed: number }; push(`OK extinction: ${r.killed} killed`); }
    catch (e) { push(`FAIL: ${e instanceof Error ? e.message : e}`); }
  };

  const maxVal = Math.max(1, ...(citizens ?? []).map((c) => Number(c.wealth ?? 0)));
  const toggleWatch = (id: string): void => setWatch((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id].slice(0, 20)));
  const telemetry = [
    { label: 'Day', value: String((sys as any)?.day ?? '—') },
    { label: 'Citizens', value: String((sys as any)?.alive ?? '—') },
    { label: 'Money supply', value: typeof (sys as any)?.moneySupply === 'number' ? `$${Number((sys as any).moneySupply).toLocaleString()}` : '—' },
    { label: 'AI queue', value: String((sys as any)?.queue ?? '—') },
  ];

  return (
    <div className="adm">
      <div className="adm-top">
        <div className="adm-heading"><span className="adm-eyebrow">Owner tools</span><b>City studio</b><span>Shape the world and see what happens next.</span></div>
        <span className="spacer" />
        <label className="adm-exp"><input type="checkbox" checked={experiment} onChange={(e) => setExperiment(e.target.checked)} /> Experiment mode {experiment ? '· confirm changes' : ''}</label>
        <button onClick={() => setPalette(true)}>Open command menu <kbd>Ctrl K</kbd></button>
        {toasts.map((t, i) => <span key={i} className="adm-toast">{t}</span>)}
      </div>
      <div className="adm-main">
        <nav className="adm-side" aria-label="City studio sections">
          {SECTION_GROUPS.map((group) => <div className="adm-nav-group" key={group.label}>
            <div className="adm-nav-label">{group.label}</div>
            {group.sections.map((s) => <button key={s} className={sec === s ? 'active' : ''} aria-current={sec === s ? 'page' : undefined} onClick={() => setSec(s)}>{s}</button>)}
          </div>)}
        </nav>
        <div className="adm-body">
          {sec === 'Citizens' && (
            <div className="adm-split">
              <div className="adm-list">
                <div className="adm-row">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search name/id…" />
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="wealth">wealth</option><option value="age">age</option>
                    <option value="health">health</option><option value="mood">mood</option><option value="name">name</option>
                  </select>
                </div>
                <div className="adm-watch">Watchlist <strong>{watch.length}</strong>{watch.length > 0 && <span>{watch.join(', ')}</span>}</div>
                {(citizens ?? []).map((c) => (
                  <div key={String(c.id)} className={`adm-cit ${sel === c.id ? 'sel' : ''} ${!c.alive ? 'dead' : ''}`}>
                    <button className="adm-cit-main" onClick={() => setSel(String(c.id))}>
                      <strong>{String(c.name)}</strong><span>{c.alive ? String(c.activity) : 'Deceased'}</span><small>${Number(c.wealth).toLocaleString()}</small>
                    </button>
                    <button title={watch.includes(String(c.id)) ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={watch.includes(String(c.id)) ? 'Remove from watchlist' : 'Add to watchlist'} onClick={() => toggleWatch(String(c.id))}>{watch.includes(String(c.id)) ? '★' : '☆'}</button>
                  </div>
                ))}
              </div>
              <div className="adm-detail">{sel ? <CitizenProfile key={sel} id={sel} push={push} /> : <div className="panel-body">Select a citizen. Search + sort live.</div>}</div>
            </div>
          )}
          {sec === 'World' && <WorldPanel push={push} />}
          {sec === 'Businesses' && <BizPanel push={push} />}
          {sec === 'Economy' && <EconPanel push={push} />}
          {sec === 'Government' && <GovPanel push={push} />}
          {sec === 'Relationships' && <RelPanel sel={sel} push={push} />}
          {sec === 'Events' && <EventsPanel push={push} events={events as Array<Record<string, unknown>> | null} />}
          {sec === 'Chaos Lab' && <ChaosPanel push={push} onExtinct={confirmExtinct} />}
          {sec === 'AI Brain' && <AIPanel push={push} heat={heat as Array<Record<string, unknown>> | null} />}
          {sec === 'Map Tools' && <MapPanel overlay={overlay} setOverlay={setOverlay} citizens={(citizens ?? []) as Array<Record<string, unknown>>} heat={(heat ?? []) as Array<Record<string, unknown>>} push={push} />}
          {sec === 'Time' && <TimePanel push={push} />}
          {sec === 'Database' && <DbPanel push={push} />}
          {sec === 'System' && <SysPanel push={push} sys={sys as Record<string, unknown> | null} />}
          {sec === 'Audit' && <AuditPanel push={push} />}
        </div>
        <aside className="adm-rail">
          <div className="adm-rail-heading"><span className="adm-eyebrow">Live world</span><b>At a glance</b></div>
          <div className="adm-telemetry">{telemetry.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
          <div className="adm-rail-heading"><span className="adm-eyebrow">From the city</span><b>Recent activity</b></div>
          <div className="adm-stream">{((events ?? []) as Array<Record<string, unknown>>).slice(0, 12).map((e) => <div key={String(e.id)}><small>Day {String(e.day ?? '—')} · {String(e.type)}</small><span>{String(e.text ?? e.summary).slice(0, 90)}</span></div>)}</div>
        </aside>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} push={push} />
    </div>
  );
}

function Btn({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={danger ? 'danger' : ''} onClick={onClick}>{children}</button>;
}

function WorldPanel({ push }: { push: (t: string) => void }) {
  const [hall, setHall] = useState<Record<string, any> | null>(null);
  useEffect(() => { adminApi.hall().then(setHall).catch(() => {}); }, []);
  return (
    <div className="panel-body">
      <h3>World</h3>
      <Btn onClick={() => adminApi.spawn({ count: 1 }).then(() => push('OK spawn')).catch((e) => push(`FAIL ${e}`))}>Spawn citizen</Btn>{' '}
      <Btn onClick={() => adminApi.preset('legend').then(() => push('OK legend')).catch((e) => push(`FAIL ${e}`))}>Spawn Legend</Btn>{' '}
      <Btn onClick={() => adminApi.preset('agent-of-chaos').then(() => push('OK chaos agent')).catch((e) => push(`FAIL ${e}`))}>Spawn Agent of Chaos</Btn>{' '}
      <Btn onClick={() => adminApi.moneyDrop(1000, 10).then(() => push('OK money drop')).catch((e) => push(`FAIL ${e}`))}>Money Drop (10×1000)</Btn>
      <h4>Hall of Fame / Infamy</h4><pre>{JSON.stringify(hall, null, 1)}</pre>
    </div>
  );
}

function BizPanel({ push }: { push: (t: string) => void }) {
  const [biz, setBiz] = useState<Array<Record<string, any>>>([]);
  const load = (): void => { adminApi.businesses().then(setBiz).catch(() => {}); };
  useEffect(load, []);
  return (
    <div className="panel-body"><h3>Businesses ({biz.length})</h3>
      <Btn onClick={() => adminApi.bizSpawn({ name: 'God Shop' }).then(() => { push('OK biz spawn'); load(); }).catch((e) => push(`FAIL ${e}`))}>Spawn business</Btn>
      {biz.map((b) => (
        <div key={b.id} className="adm-row">{b.name} ({b.type}) funds={b.funds} owner={b.ownerId ?? '—'}
          <Btn onClick={() => adminApi.bizAdmin(b.id, { funds: (Number(b.funds) || 0) + 5000 }).then(() => { push('OK +funds'); load(); }).catch((e) => push(`FAIL ${e}`))}>+5k</Btn>
          <Btn onClick={() => { const c = prompt('new owner citizen id'); if (c) adminApi.bizAdmin(b.id, { ownerId: c }).then(() => { push('OK owner'); load(); }).catch((e) => push(`FAIL ${e}`)); }}>owner</Btn>
        </div>
      ))}
    </div>
  );
}

function EconPanel({ push }: { push: (t: string) => void }) {
  const [e, setE] = useState<Record<string, any> | null>(null);
  const load = (): void => { adminApi.economy().then(setE).catch(() => {}); };
  useEffect(load, []);
  return (
    <div className="panel-body"><h3>Economy</h3><pre>{JSON.stringify(e, null, 1)}</pre>
      <Btn onClick={() => adminApi.economySet({ treasuryDelta: 10000 }).then(() => { push('OK treasury+'); load(); }).catch((er) => push(`FAIL ${er}`))}>Treasury +10k</Btn>{' '}
      <Btn onClick={() => adminApi.effect({ scope: 'citywide', kind: 'prices', multiplier: 1.2, label: 'god inflation' }).then(() => push('OK inflation x1.2')).catch((er) => push(`FAIL ${er}`))}>Inflation x1.2</Btn>{' '}
      <Btn danger onClick={() => { if (window.confirm('NUKE economy? (auto-snapshot taken)')) adminApi.nuke(0.1).then(() => { push('OK nuked'); load(); }).catch((er) => push(`FAIL ${er}`)); }}>Nuke Economy</Btn>
    </div>
  );
}

function GovPanel({ push }: { push: (t: string) => void }) {
  const [g, setG] = useState<Record<string, any> | null>(null);
  const load = (): void => { adminApi.government().then(setG).catch(() => {}); };
  useEffect(load, []);
  return (
    <div className="panel-body"><h3>Government</h3><pre>{JSON.stringify(g, null, 1)}</pre>
      <Btn onClick={() => { const t = prompt('tax rate 0..1', '0.15'); if (t) adminApi.govSet({ taxRate: Number(t) }).then(() => { push('OK tax'); load(); }).catch((e) => push(`FAIL ${e}`)); }}>Set tax</Btn>{' '}
      <Btn onClick={() => { const t = prompt('law text'); if (t) adminApi.law(t).then(() => push('OK law')).catch((e) => push(`FAIL ${e}`)); }}>Decree law</Btn>{' '}
      <Btn onClick={() => adminApi.election().then(() => { push('OK election'); load(); }).catch((e) => push(`FAIL ${e}`))}>Snap election</Btn>{' '}
      <Btn onClick={() => { const a = prompt('arrest citizen id'); if (a) adminApi.arrest(a).then(() => push('OK arrest')).catch((e) => push(`FAIL ${e}`)); }}>Arrest</Btn>{' '}
      <Btn onClick={() => { const a = prompt('release citizen id'); if (a) adminApi.release(a).then(() => push('OK release')).catch((e) => push(`FAIL ${e}`)); }}>Release</Btn>
    </div>
  );
}

function RelPanel({ sel, push }: { sel: string | null; push: (t: string) => void }) {
  return (
    <div className="panel-body"><h3>Relationships</h3>
      <p>Select a citizen, open their profile → section 9 for sliders. Quick tools here:</p>
      <Btn onClick={() => { if (!sel) { push('select citizen first'); return; } const o = prompt('other id'); if (o) adminApi.op(sel, 'relationship', { otherId: o, patch: { trust: 1, affection: 1, type: 'close_friend' } }).then(() => push('OK befriend')).catch((e) => push(`FAIL ${e}`)); }}>Befriend…</Btn>{' '}
      <Btn onClick={() => { if (!sel) { push('select citizen first'); return; } const o = prompt('other id'); if (o) adminApi.op(sel, 'relationship', { otherId: o, patch: { trust: 0, resentment: 1, type: 'enemy' } }).then(() => push('OK enemy')).catch((e) => push(`FAIL ${e}`)); }}>Make enemy…</Btn>
    </div>
  );
}

function EventsPanel({ push, events }: { push: (t: string) => void; events: Array<Record<string, unknown>> | null }) {
  const [rumour, setRumour] = useState('');
  return (
    <div className="panel-body"><h3>Events / Rumours / Secrets</h3>
      <input value={rumour} onChange={(e) => setRumour(e.target.value)} placeholder="rumour text" style={{ width: '60%' }} />{' '}
      <Btn onClick={() => { if (rumour) adminApi.rumour(rumour).then(() => push('OK rumour')).catch((e) => push(`FAIL ${e}`)); }}>Rumour Creator</Btn>{' '}
      <Btn onClick={() => adminApi.secretGen().then((r) => push(`OK secret ${(r as { text: string }).text}`)).catch((e) => push(`FAIL ${e}`))}>Secret Generator</Btn>{' '}
      <Btn onClick={() => { const s = prompt('event summary'); if (s) adminApi.eventSpawn('GodIntervention', s).then(() => push('OK event')).catch((e) => push(`FAIL ${e}`)); }}>Spawn event</Btn>
      <div className="adm-stream">{(events ?? []).map((e) => <div key={String(e.id)}>D{e.day as number} [{String(e.type)}] {String(e.text ?? e.summary)}</div>)}</div>
    </div>
  );
}

function ChaosPanel({ push, onExtinct }: { push: (t: string) => void; onExtinct: () => void }) {
  return (
    <div className="panel-body"><h3>Chaos Lab</h3>
      <Btn onClick={() => adminApi.miracle('blessing').then(() => push('OK miracle')).catch((e) => push(`FAIL ${e}`))}>Miracle (blessing)</Btn>{' '}
      <Btn onClick={() => adminApi.miracle('revive-all').then(() => push('OK revive-all')).catch((e) => push(`FAIL ${e}`))}>Miracle (revive-all)</Btn>{' '}
      <Btn onClick={() => adminApi.chaos('chaos').then((r) => push(`OK chaos ${(r as { kind: string }).kind}`)).catch((e) => push(`FAIL ${e}`))}>Random Chaos</Btn>{' '}
      <Btn onClick={() => adminApi.chaos('blessing').then(() => push('OK blessing')).catch((e) => push(`FAIL ${e}`))}>Random Blessing</Btn>{' '}
      <Btn onClick={() => adminApi.pick('victim').then((r) => push(`victim: ${JSON.stringify(r)}`)).catch((e) => push(`FAIL ${e}`))}>Pick Victim</Btn>{' '}
      <Btn onClick={() => adminApi.pick('champion').then((r) => push(`champion: ${JSON.stringify(r)}`)).catch((e) => push(`FAIL ${e}`))}>Pick Champion</Btn>{' '}
      <Btn danger onClick={onExtinct}>MASS EXTINCTION (type EXTINCTION)</Btn>
    </div>
  );
}

function AIPanel({ push, heat }: { push: (t: string) => void; heat: Array<Record<string, unknown>> | null }) {
  const [prompt, setPrompt] = useState('Reflect deeply on your life.');
  const [cid, setCid] = useState('');
  return (
    <div className="panel-body"><h3>AI Brain (inspect vs control separated)</h3>
      <Btn onClick={() => adminApi.aiPause().then(() => push('OK ai paused')).catch((e) => push(`FAIL ${e}`))}>Pause AI</Btn>{' '}
      <Btn onClick={() => adminApi.aiResume().then(() => push('OK ai resumed')).catch((e) => push(`FAIL ${e}`))}>Resume AI</Btn>
      <div className="adm-row"><input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="citizen id" />
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="force-thought prompt" style={{ width: '50%' }} />
        <Btn onClick={() => { if (cid) adminApi.forceThink(cid, prompt).then(() => push('OK force-think')).catch((e) => push(`FAIL ${e}`)); }}>Force-think</Btn></div>
      <p>Note: in-world dialogue (CitizenPanel ask) is roleplay; Interrogate/force-thought here is OWNER-level inspection.</p>
      <h4>Attention heatmap</h4>
      <div className="adm-heat">{(heat ?? []).slice(0, 30).map((h) => <span key={String(h.id)} title={`${String(h.name)} ${String(h.attention)}`} className={`heat ${String(h.class)}`}>●</span>)}</div>
    </div>
  );
}

function MapPanel({ overlay, setOverlay, citizens, heat, push }: { overlay: string; setOverlay: (s: string) => void; citizens: Array<Record<string, unknown>>; heat: Array<Record<string, unknown>>; push: (t: string) => void }) {
  void push;
  const heatById = new Map((heat ?? []).map((h) => [String(h.id), h]));
  return (
    <div className="panel-body"><h3>Map Tools — overlay: {overlay}</h3>
      <select value={overlay} onChange={(e) => setOverlay(e.target.value)}>
        <option value="wealth">wealth</option><option value="crime">crime (arrests)</option>
        <option value="stress">stress</option><option value="happiness">happiness</option><option value="ai">AI attention</option>
      </select>
      <div className="adm-map">
        {citizens.slice(0, 200).map((c) => {
          const h = heatById.get(String(c.id));
          const ai = Number(h?.attention ?? 0);
          const w = Number(c.wealth ?? 0);
          const color = overlay === 'ai' ? `rgba(255,0,255,${Math.min(1, ai)})`
            : overlay === 'wealth' ? `rgba(0,200,0,${Math.min(1, w / 20000)})`
            : overlay === 'health' ? 'rgba(0,0,255,.6)' : 'rgba(255,165,0,.6)';
          return <span key={String(c.id)} title={`${String(c.name)} $${w} ai=${ai}`} style={{ background: color }} className="adm-dot">{c.alive ? '' : 'x'}</span>;
        })}
      </div>
      <p>Heat dots encode the active overlay. Full GIS layers: SYSTEM NOT IMPLEMENTED (renders disabled).</p>
      <button disabled title="SYSTEM NOT IMPLEMENTED">Export GIS</button>
    </div>
  );
}

function TimePanel({ push }: { push: (t: string) => void }) {
  const [snaps, setSnaps] = useState<Array<Record<string, any>>>([]);
  const load = (): void => { adminApi.snapshots().then(setSnaps).catch(() => {}); };
  useEffect(load, []);
  return (
    <div className="panel-body"><h3>Time machine + snapshots</h3>
      <Btn onClick={() => adminApi.time({ paused: true }).then(() => push('OK paused')).catch((e) => push(`FAIL ${e}`))}>Pause</Btn>{' '}
      <Btn onClick={() => adminApi.time({ paused: false }).then(() => push('OK resume')).catch((e) => push(`FAIL ${e}`))}>Resume</Btn>{' '}
      <Btn onClick={() => adminApi.step(1).then(() => push('OK step')).catch((e) => push(`FAIL ${e}`))}>Step 1</Btn>{' '}
      <Btn onClick={() => adminApi.step(100).then(() => push('OK step 100')).catch((e) => push(`FAIL ${e}`))}>Step 100</Btn>{' '}
      <Btn onClick={() => adminApi.runUntil({ day: (Number(prompt('run until day?', '30')) || 30) }).then((r) => push(`OK ran ${JSON.stringify(r)}`)).catch((e) => push(`FAIL ${e}`))}>Run until day…</Btn>
      <h4>Snapshots (CRUD + duplicate)</h4>
      <Btn onClick={() => { const n = prompt('snapshot name', `snap_${Date.now()}`); if (n) adminApi.snapCreate(n).then(() => { push('OK snap'); load(); }).catch((e) => push(`FAIL ${e}`)); }}>Create</Btn>
      {snaps.map((s) => (
        <div key={String(s.name)} className="adm-row">{String(s.name)} tick={String(s.tick ?? '?')}
          <Btn onClick={() => adminApi.snapRestore(String(s.name)).then(() => push('OK restored')).catch((e) => push(`FAIL ${e}`))}>Restore</Btn>
          <Btn onClick={() => adminApi.snapDup(String(s.name)).then(() => { push('OK dup'); load(); }).catch((e) => push(`FAIL ${e}`))}>Duplicate</Btn>
          <Btn danger onClick={() => { if (window.confirm(`delete ${s.name}?`)) adminApi.snapDelete(String(s.name)).then(() => { push('OK del'); load(); }).catch((e) => push(`FAIL ${e}`)); }}>Delete</Btn>
        </div>
      ))}
    </div>
  );
}

function DbPanel({ push }: { push: (t: string) => void }) {
  const [d, setD] = useState<Record<string, any> | null>(null);
  useEffect(() => { adminApi.database().then(setD).catch((e) => push(`DB (OWNER only): ${e instanceof Error ? e.message : e}`)); }, [push]);
  return (
    <div className="panel-body"><h3>Database (OWNER role required)</h3>
      {!d ? <p>Locked or loading. Non-OWNER roles render disabled: <button disabled title="SYSTEM NOT IMPLEMENTED">raw SQL</button></p> : <pre>{JSON.stringify(d, null, 1)}</pre>}
    </div>
  );
}

function SysPanel({ push, sys }: { push: (t: string) => void; sys: Record<string, unknown> | null }) {
  const [checks, setChecks] = useState<Array<{ check: string; ok: boolean; detail: string }>>([]);
  useEffect(() => { adminApi.invariants().then((r) => setChecks(r.checks)).catch(() => {}); }, []);
  return (
    <div className="panel-body"><h3>System / debug</h3><pre>{JSON.stringify(sys, null, 1)}</pre>
      <h4>Invariant check</h4>
      {checks.map((c) => <div key={c.check} className={c.ok ? '' : 'adm-bad'}>{c.ok ? '✅' : '❌'} {c.check}: {c.detail}</div>)}
      <Btn onClick={() => adminApi.verify().then(() => push('OK verify')).catch((e) => push(`FAIL ${e}`))}>verify-world</Btn>
    </div>
  );
}

function AuditPanel({ push }: { push: (t: string) => void }) {
  const [a, setA] = useState<{ live: Array<Record<string, any>>; persisted: Array<Record<string, any>> } | null>(null);
  const load = (): void => { adminApi.audit(100).then(setA).catch((e) => push(`FAIL ${e}`)); };
  useEffect(load, []);
  return (
    <div className="panel-body"><h3>Audit (every mutation, source:ADMIN)</h3>
      <Btn onClick={load}>Refresh</Btn>{' '}
      <a href="/api/admin/audit/export?format=json" target="_blank" rel="noreferrer"><button>Export JSON</button></a>
      {(a?.live ?? []).map((e) => (
        <div key={String(e.id)} className="adm-audit">[{new Date(Number(e.ts)).toLocaleTimeString()}] {String(e.actor)} {String(e.action)} → {String(e.target)} <i>{String(e.reason).slice(0, 80)}</i> ({String(e.reversible)})</div>
      ))}
    </div>
  );
}
