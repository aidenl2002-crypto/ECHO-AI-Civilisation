// PEOPLE view: roster + deep citizen profile (overview, MIND, relationships,
// family tree, biography, moments, death).
import React, { useEffect, useMemo, useState } from 'react';
import { api, type CitizenDetail, type CitizenSummary } from '../api';
import { useEcho } from '../store';
import { Avatar, Bar, Chart, Empty, EventCard, Panel, Ring, Segmented, Sparkline } from '../primitives';
import { Icon } from '../icons';

type SortK = 'wealth' | 'mood' | 'health' | 'age' | 'name';

function jobLabel(job: string | null | undefined): string {
  if (!job || /^(none|unemployed|jobless|null)$/i.test(job)) return 'Finding their path';
  const seededJobs = ['Bartender', 'Chef', 'Grocer', 'Factory worker', 'Shopkeeper', 'Vendor', 'Nurse', 'Clerk'];
  const seeded = /^j_([0-7])$/.exec(job);
  if (seeded) return seededJobs[Number(seeded[1])];
  if (/^j_(extra|\d)/.test(job)) return 'Working';
  const words = job.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Working';
}

export default function PeopleView() {
  const e = useEcho();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortK>('wealth');
  const [sel, setSel] = useState<string | null>(e.selCitizen);
  useEffect(() => { setSel(e.selCitizen); }, [e.selCitizen]);

  const list = useMemo(() => {
    const f = e.citizens.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.job.toLowerCase().includes(q.toLowerCase()) || c.id.includes(q));
    const val = (c: CitizenSummary): number | string => {
      switch (sort) {
        case 'wealth': return c.wealth; case 'mood': return c.mood ?? 0; case 'health': return c.health ?? 0;
        case 'age': return c.age; case 'name': return c.name;
      }
    };
    return [...f].sort((a, b) => {
      const va = val(a), vb = val(b);
      return typeof va === 'string' ? va.localeCompare(vb as string) : (vb as number) - (va as number);
    }).slice(0, 150);
  }, [e.citizens, q, sort]);

  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">The citizens</span><h1>Every life has a story.</h1><p className="view-summary">Meet the people shaping Echo City. Follow their work, relationships and the moments that change them.</p><div className="view-statline"><span>{e.citizens.length} residents</span><span>{e.citizens.filter((c) => c.alive !== false).length} living</span></div></div>
      <div className="people-layout">
        <div className="people-directory">
          <div className="row" style={{ marginBottom: 8 }}>
            <input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Search name, job, id…" style={{ flex: 1 }} />
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <Segmented<SortK> value={sort} onChange={setSort} options={[
              { v: 'wealth', label: '$' }, { v: 'mood', label: 'mood' }, { v: 'health', label: 'health' }, { v: 'age', label: 'age' }, { v: 'name', label: 'A–Z' },
            ]} />
          </div>
          <div className="people-directory-list">
            {list.map((c) => (
              <div key={c.id} className={sel === c.id ? 'list-row sel' : 'list-row'}
                onClick={() => { setSel(c.id); e.setSelCitizen(c.id); }}>
                <Avatar seed={c.id} name={c.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.name} {c.alive === false && <span className="faint">†</span>}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{jobLabel(c.job)} · ${Math.round(c.wealth).toLocaleString()}</div>
                </div>
                <span className="faint" style={{ fontSize: 12 }}>{Math.round(c.mood ?? 0)} mood</span>
              </div>
            ))}
            {list.length === 0 && <Empty text="No citizens match." />}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {sel ? <CitizenDetailView key={sel} id={sel} /> : (
            <div className="people-welcome" style={{ minHeight: 440, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 40, border: '1px solid #e6e3da', borderRadius: 20, background: '#fffdfa' }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: 18, marginBottom: 24 }}>
                {e.citizens.slice(0, 4).map((c, i) => <div key={c.id} style={{ marginLeft: -18, border: '4px solid #fffdfa', borderRadius: '50%', transform: `translateY(${i % 2 ? 8 : -8}px)` }}><Avatar seed={c.id} name={c.name} size={56} /></div>)}
              </div>
              <span className="view-kicker">A city of stories</span>
              <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 32, margin: '10px 0' }}>Get to know someone.</h2>
              <p className="dim" style={{ maxWidth: 340, lineHeight: 1.6 }}>Each resident has a life in motion. Choose a person to see where they live, what matters to them, and who they know.</p>
              {list[0] && <button onClick={() => { setSel(list[0].id); e.setSelCitizen(list[0].id); }} style={{ marginTop: 16 }}>Meet {list[0].name}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type CTab = 'overview' | 'mind' | 'people' | 'bio';

function CitizenDetailView({ id }: { id: string }) {
  const e = useEcho();
  const [d, setD] = useState<CitizenDetail | null>(null);
  const [mind, setMind] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<CTab>('overview');
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let live = true;
    api.citizen(id).then((x) => { if (live) setD(x); }).catch(() => { if (live) setD(null); });
    api.mind(id).then((m) => { if (live && m) setMind(m); }).catch(() => {});
    return () => { live = false; };
  }, [id]);

  const ask = async () => {
    if (!q.trim()) return;
    setAsking(true);
    try { setAnswer((await api.ask(id, q)).answer); }
    catch { setAnswer('(no answer — backend offline or AI disabled)'); }
    setAsking(false);
  };

  if (d === null) return <div className="dim">Loading citizen…</div>;
  if (!d) return <div className="dim">Citizen not found (may have died or backend offline).</div>;

  const dead = d.alive === false;
  const finHist = (d.financialHistory ?? []).map((f) => f.amount);
  const moments = [...(d.events ?? [])].filter((m) => /birth|born|marri|wedding|found|arrest|elect|died|death/i.test(m.text)).slice(-4);

  return (
    <div>
      <div className="panel">
        <div className="row">
          <Avatar seed={d.id} name={d.name} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, fontWeight: 600 }}>{d.name} {dead && <span style={{ color: '#b86351' }}>†</span>}</div>
            <div className="dim">{d.age} years old · {jobLabel(d.job)} · <span className="mono">{d.id.slice(0, 12)}</span></div>
            <div className="dim" style={{ fontSize: 12 }}>Doing <b>{d.activity ?? '—'}</b> · Home {d.home ?? '—'}</div>
          </div>
          <Ring value={d.mood} color={d.mood > 60 ? '#258b80' : d.mood > 30 ? '#c89a51' : '#b86351'} label="mood" />
          <Ring value={d.health} color={d.health > 60 ? '#87a794' : d.health > 30 ? '#c89a51' : '#b86351'} label="health" />
          <div style={{ textAlign: 'center' }}><div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>${Math.round(d.wealth).toLocaleString()}</div><div className="faint" style={{ fontSize: 10 }}>WEALTH</div></div>
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className={e.follow && e.selCitizen === id ? 'active' : ''} onClick={() => { e.setSelCitizen(id); e.setFollow(!e.follow); }}>
            <Icon name="eye" size={13} /> {e.follow && e.selCitizen === id ? 'Following' : 'Follow'}
          </button>
          <button onClick={() => { e.setSelCitizen(id); e.setView('city'); }}>Locate on map</button>
          <button onClick={() => setTab('mind')}>Open mind</button>
        </div>
      </div>

      {dead && (
        <div className="death-card" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{d.name} died{d.deadDay ? ` on day ${d.deadDay}` : ''}</div>
          <div className="dim">{d.causeOfDeath ?? 'Cause unknown. The city remembers.'}</div>
        </div>
      )}

      {moments.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {moments.map((m, i) => <div key={i} className="moment">◆ Day {m.day} — {m.text}</div>)}
        </div>
      )}

      <div className="tabs" style={{ marginTop: 12 }}>
        {(['overview', 'mind', 'people', 'bio'] as CTab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'people' ? 'Relationships' : t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          <div className="grid2">
            <Panel title="Vitals" icon="heart">
              <Bar label="health" value={d.health} color="#87a794" />
              <Bar label="mood" value={d.mood} color={d.mood > 60 ? '#258b80' : d.mood > 30 ? '#c89a51' : '#b86351'} />
              <Bar label="wealth" value={Math.min(100, d.wealth / 300)} color="#c89a51" />
            </Panel>
            <Panel title="Wealth trajectory" icon="chart">
              {finHist.length > 1 ? <Sparkline data={finHist.slice(-40)} width={220} height={54} color="#c89a51" /> : <div className="faint">No financial history yet.</div>}
            </Panel>
          </div>
          {d.personality && <Panel title="Personality" icon="users">{Object.entries(d.personality).map(([k, v]) => <Bar key={k} label={k} value={Number(v) <= 1 ? Number(v) * 100 : Number(v)} color="#258b80" />)}</Panel>}
          {d.skills && <Panel title="Skills" icon="zap">{Object.entries(d.skills).map(([k, v]) => <Bar key={k} label={k} value={Number(v)} color="#dc7a5f" />)}</Panel>}
          <div className="grid2">
            <Panel title="Goals" icon="eye">
              {(d.goals ?? []).length === 0 && <div className="faint">No recorded goals.</div>}
              <ul style={{ margin: 0, paddingLeft: 16 }}>{(d.goals ?? []).map((g, i) => <li key={i}>{g}</li>)}</ul>
            </Panel>
            <Panel title="Household" icon="city">
              {(d.family ?? []).filter((f) => /spouse|child|parent|sibling|partner/i.test(f.relation)).length === 0 && <div className="faint">Lives alone (no recorded household).</div>}
              <ul style={{ margin: 0, paddingLeft: 16 }}>{(d.family ?? []).filter((f) => /spouse|child|parent|sibling|partner/i.test(f.relation)).map((f) => (
                <li key={f.id}>{f.name} — {f.relation}</li>))}</ul>
              <div className="kv" style={{ marginTop: 6 }}><span>home</span><b>{d.home ?? '—'}</b></div>
            </Panel>
          </div>
          <Panel title="Recent events" icon="clock">
            {(d.events ?? []).slice(-6).reverse().map((m, i) => <EventCard key={i} day={m.day} type="life" text={m.text} />)}
            {(d.events ?? []).length === 0 && <div className="faint">A quiet life, so far.</div>}
          </Panel>
        </div>
      )}

      {tab === 'mind' && (
        <MindView d={d} mind={mind} q={q} setQ={setQ} answer={answer} ask={ask} asking={asking} />
      )}

      {tab === 'people' && (
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          <Panel title="Relationship graph" icon="users">
            <RelGraph d={d} />
          </Panel>
          <Panel title="Family tree" icon="city">
            {(d.family ?? []).length === 0 && <div className="faint">No recorded family. Every legend starts somewhere.</div>}
            <div className="fam-tree">
              {(d.family ?? []).map((f) => (
                <span key={f.id} className="chip" style={{ borderColor: '#c89a51' }}>{f.relation}: {f.name}</span>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'bio' && (
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          <Panel title="Biography archive" icon="book">
            <BioArchive d={d} />
          </Panel>
          <Panel title="Employment" icon="shop">
            {(d.employmentHistory ?? []).slice(-8).reverse().map((m, i) => <div key={i} className="row" style={{ fontSize: 12 }}><span className="mono faint">D{m.day}</span><span>{m.job}</span></div>)}
            {(d.employmentHistory ?? []).length === 0 && <div className="faint">No job changes on record.</div>}
          </Panel>
          <Panel title="EchoNet posts" icon="msg">
            {(d.posts ?? []).slice(-5).reverse().map((m, i) => <div key={i} className="post"><div className="pt">{m.text}</div><div className="faint mono" style={{ fontSize: 10 }}>day {m.day}</div></div>)}
            {(d.posts ?? []).length === 0 && <div className="faint">Never posted. A lurker.</div>}
          </Panel>
        </div>
      )}
    </div>
  );
}

function MindView({ d, mind, q, setQ, answer, ask, asking }: {
  d: CitizenDetail; mind: Record<string, unknown> | null;
  q: string; setQ: (s: string) => void; answer: string; ask: () => void; asking: boolean;
}) {
  const m = (mind?.mind ?? mind ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => typeof v === 'string' ? v : Array.isArray(v) ? v.join('; ') : v == null ? '' : JSON.stringify(v);
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : [];
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
      <Panel title="Thought summaries (never chain-of-thought)" icon="brain">
        {(d.memories ?? []).slice(-4).reverse().map((x, i) => <div key={i} className="feed-item">💭 <span className="mono faint">D{x.day}</span> {x.text}</div>)}
        {(d.memories ?? []).length === 0 && <div className="faint">No recorded thoughts yet.</div>}
        {mind == null && <div className="faint">Cognition layer offline — showing lived memory only.</div>}
      </Panel>
      <div className="grid2">
        <Panel title="Concerns" icon="flame">
          {arr(m.concerns ?? (d as { concerns?: string[] }).concerns).map((c, i) => <div key={i} className="ev-card" style={{ borderLeftColor: '#b86351' }}>{c}</div>)}
          {arr(m.concerns).length === 0 && <div className="faint">No recorded concerns.</div>}
        </Panel>
        <Panel title="Beliefs" icon="scale">
          {arr(m.beliefs ?? (d as { beliefs?: string[] }).beliefs).map((c, i) => <div key={i} className="ev-card" style={{ borderLeftColor: '#ad7b8a' }}>{c}</div>)}
          {arr(m.beliefs).length === 0 && <div className="faint">No recorded beliefs.</div>}
        </Panel>
      </div>
      <Panel title="Plans & goals" icon="eye">
        <ul style={{ margin: 0, paddingLeft: 16 }}>{(d.goals ?? []).map((g, i) => <li key={i}>{g}</li>)}</ul>
        {m.plan ? <div className="feed-item">🗺 {str(m.plan)}</div> : null}
        {(d.goals ?? []).length === 0 && !m.plan && <div className="faint">Drifting day to day.</div>}
      </Panel>
      <Panel title="Ask this mind (roleplay)" icon="msg">
        <div className="row"><input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Ask anything…" style={{ flex: 1 }} /><button onClick={ask} disabled={asking}>{asking ? '…' : 'Ask'}</button></div>
        {answer && <p style={{ background: '#f5f2eb', padding: 14, borderRadius: 12 }}>{answer}</p>}
      </Panel>
    </div>
  );
}

function relColor(score: number, type?: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('spouse') || t.includes('partner') || t.includes('marri')) return '#ad7b8a';
  if (t.includes('family') || t.includes('kin')) return '#c89a51';
  if (score >= 60) return '#258b80';
  if (score <= 25) return '#b86351';
  return '#87a794';
}

function RelGraph({ d }: { d: CitizenDetail }) {
  const e = useEcho();
  const rels = (d.relationships ?? []).slice(0, 12);
  const [focusR, setFocusR] = useState<string | null>(null);
  if (rels.length === 0) return <div className="faint">No relationships yet — a stranger in their own city.</div>;
  const W = 560, H = Math.max(220, rels.length * 34 + 70);
  const cx = 110, cy = H / 2;
  return (
    <div>
      <svg className="rel-svg" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {rels.map((r, i) => {
          const a = (i / rels.length) * Math.PI * 2 - Math.PI / 2;
          const x = 360 + Math.cos(a) * 130, y = cy + Math.sin(a) * (H / 2 - 50);
          const col = relColor(r.score, r.type);
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => setFocusR(focusR === r.id ? null : r.id)}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={col} strokeWidth={focusR === r.id ? 3 : 1.4} opacity={focusR && focusR !== r.id ? 0.25 : 0.85} />
              <circle cx={x} cy={y} r={focusR === r.id ? 17 : 13} fill={col + '33'} stroke={col} strokeWidth={2} />
              <text x={x} y={y + 3.5} textAnchor="middle" fill="#27332f" fontSize={10} fontWeight={700}>{r.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</text>
              <text x={x} y={y + 28} textAnchor="middle">{r.name.slice(0, 14)} · {Math.round(r.score)}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={26} fill="#e4f0e8" stroke="#258b80" strokeWidth={2} />
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#27332f" fontSize={11} fontWeight={700}>{d.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</text>
        <text x={cx} y={cy + 40} textAnchor="middle">{d.name.slice(0, 16)}</text>
      </svg>
      {focusR && (() => {
        const r = rels.find((x) => x.id === focusR);
        if (!r) return null;
        return (
          <div className="feed-item">
            <b>{r.name}</b> — score {Math.round(r.score)}{r.type ? ` · ${r.type}` : ''}
            <div className="row" style={{ marginTop: 6 }}>
              <button onClick={() => { e.setSelCitizen(r.id); }}>Open profile</button>
            </div>
          </div>
        );
      })()}
      <div className="row wrap faint" style={{ fontSize: 11, marginTop: 4 }}>
        <span><i style={{ color: '#258b80' }}>●</i> friend</span><span><i style={{ color: '#b86351' }}>●</i> hostile</span>
        <span><i style={{ color: '#ad7b8a' }}>●</i> romance</span><span><i style={{ color: '#c89a51' }}>●</i> family</span>
        <span><i style={{ color: '#87a794' }}>●</i> neutral</span>
      </div>
    </div>
  );
}

function BioArchive({ d }: { d: CitizenDetail }) {
  const evs = [...(d.events ?? [])].sort((a, b) => a.day - b.day);
  const mems = [...(d.memories ?? [])].sort((a, b) => a.day - b.day);
  const emp = [...(d.employmentHistory ?? [])].sort((a, b) => a.day - b.day);
  if (!evs.length && !mems.length && !emp.length) return <div className="faint">The archive is empty — this life is still being written.</div>;
  const chapters = (() => {
    const byDay = new Map<number, string[]>();
    const push = (day: number, t: string) => { byDay.set(day, [...(byDay.get(day) ?? []), t]); };
    for (const x of emp) push(x.day, `Took work as ${x.job}.`);
    for (const x of evs) push(x.day, x.text);
    for (const x of mems.slice(-12)) push(x.day, `Remembers: ${x.text}`);
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  })();
  return (
    <div className="tl-rail">
      <div className="tl-node"><b>Born into Echo City.</b><div className="faint">Every citizen arrives with nothing but a name.</div></div>
      {chapters.map(([day, lines]) => (
        <div key={day} className="tl-node">
          <span className="chip mono">DAY {day}</span>
          {lines.map((l, i) => <div key={i} style={{ fontSize: 12.5, marginTop: 3 }}>{l}</div>)}
        </div>
      ))}
      {d.alive === false && <div className="tl-node"><b>☠ Died{d.deadDay ? ` day ${d.deadDay}` : ''}.</b><div className="faint">{(d as { causeOfDeath?: string }).causeOfDeath ?? ''}</div></div>}
    </div>
  );
}

export function CitizenWealthChart({ id }: { id: string }) {
  const [d, setD] = useState<CitizenDetail | null>(null);
  useEffect(() => { api.citizen(id).then(setD).catch(() => {}); }, [id]);
  const data = (d?.financialHistory ?? []).map((f) => f.amount);
  if (data.length < 2) return null;
  return <Chart data={data} height={110} color="#c89a51" yLabel="$" />;
}
