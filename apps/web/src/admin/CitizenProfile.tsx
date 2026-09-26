// CitizenProfile: full 14-section admin profile + sliders/editors + raw JSON.
import React, { useEffect, useState } from 'react';
import { adminApi } from './adminApi';

function Slider({ label, value, min = 0, max = 1, step = 0.01, onCommit }: { label: string; value: number; min?: number; max?: number; step?: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="adm-slider">{label} <b>{typeof v === 'number' ? v.toFixed(2) : v}</b>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => setV(Number(e.target.value))} onMouseUp={() => onCommit(v)} onTouchEnd={() => onCommit(v)} />
    </label>
  );
}

export default function CitizenProfile({ id, push, onChanged }: { id: string; push: (t: string) => void; onChanged?: () => void }) {
  const [d, setD] = useState<Record<string, any> | null>(null);
  const [err, setErr] = useState('');
  const [memText, setMemText] = useState('');
  const [implant, setImplant] = useState(false);
  const load = () => adminApi.full(id).then(setD).catch((e) => setErr(String(e)));
  useEffect(() => { setD(null); load(); }, [id]);

  const run = async (op: string, body: unknown, label: string, danger = false) => {
    if (danger && !window.confirm(`Confirm destructive admin op: ${label} on ${id}?`)) return;
    try { await adminApi.op(id, op, body); push(`OK ${label}`); load(); onChanged?.(); }
    catch (e) { push(`FAIL ${label}: ${e instanceof Error ? e.message : e}`); }
  };
  const money = async (amount: number) => {
    try { await adminApi.money(id, amount, 'console'); push(`OK money ${amount}`); load(); onChanged?.(); }
    catch (e) { push(`FAIL money: ${e instanceof Error ? e.message : e}`); }
  };

  if (err) return <div className="panel-body">Error: {err}</div>;
  if (!d) return <div className="panel-body">Loading citizen…</div>;
  const c = d.raw ?? {};
  const commitTrait = (k: string) => (v: number) => run('personality', { traits: { [k]: v } }, `trait ${k}`);
  return (
    <div className="adm-profile">
      <div className="adm-profile-hero">
        <div className="adm-profile-avatar" aria-hidden="true">{String(d.identity?.name ?? '?').slice(0, 1).toUpperCase()}</div>
        <div><span className="adm-eyebrow">Citizen profile</span><h3>{d.identity?.name}</h3><p>{String(c.activity ?? 'City resident')} · {String(id)}</p></div>
        <span className={`adm-profile-status ${d.identity?.alive ? '' : 'is-dead'}`}>{d.identity?.alive ? 'Living' : 'Deceased'}{d.identity?.immortal ? ' · Immortal' : ''}{d.identity?.possessed ? ' · Possessed' : ''}</span>
      </div>
      <div className="adm-profile-quick">
        <div><span>Age</span><strong>{String(d.identity?.age ?? c.age ?? '—')}</strong></div>
        <div><span>Occupation</span><strong>{String(c.jobName ?? c.jobId ?? '—')}</strong></div>
        <div><span>Cash</span><strong>{typeof c.cash === 'number' ? `$${c.cash.toLocaleString()}` : '—'}</strong></div>
      </div>
      <div className="adm-sec"><b>1 Identity</b><pre>{JSON.stringify(d.identity, null, 1)}</pre></div>
      <div className="adm-sec"><b>2 Position/Home</b><pre>{JSON.stringify(d.position, null, 1)}</pre>
        <button onClick={() => { const x = prompt('x', '500'); const y = prompt('y', '500'); if (x && y) run('teleport', { x: Number(x), y: Number(y) }, 'teleport'); }}>Teleport</button></div>
      <div className="adm-sec"><b>3 Work/Activity</b><pre>{JSON.stringify(d.work, null, 1)}</pre>
        <button onClick={() => run('fire', {}, 'fire')}>Fire</button> <button onClick={() => run('mayor', {}, 'make mayor')}>Make Mayor</button></div>
      <div className="adm-sec"><b>4 Needs</b><pre>{JSON.stringify(d.needs, null, 1)}</pre>
        <button onClick={() => run('heal', {}, 'heal')}>Heal</button> <button onClick={() => run('injure', { amount: 30 }, 'injure')}>Injure</button></div>
      <div className="adm-sec"><b>5 Mood/Emotions</b><pre>{JSON.stringify(d.mood, null, 1)}</pre>
        <button onClick={() => run('mood', { joy: 1, happiness: 100 }, 'bless mood')}>Bless</button></div>
      <div className="adm-sec"><b>6 Personality (sliders)</b>
        {Object.entries(c.psychology ?? {}).map(([k, v]) => <Slider key={k} label={k} value={Number(v)} onCommit={commitTrait(k)} />)}</div>
      <div className="adm-sec"><b>7 Skills</b><pre>{JSON.stringify(d.raw?.skills ?? c.skills, null, 1)}</pre>
        <button onClick={() => run('skills', { skills: { leadership: 90, combat: 90 } }, 'boost skills')}>Boost lead/combat</button></div>
      <div className="adm-sec"><b>8 Finances + ledger</b><pre>{JSON.stringify(d.finances, null, 1)}</pre>
        <button onClick={() => money(1000)}>+1000</button> <button onClick={() => money(-500)}>-500</button>
        <button onClick={() => run('rich', {}, 'rich')}>Rich</button>
        <button className="danger" onClick={() => run('bankrupt', {}, 'BANKRUPT', true)}>Bankrupt</button></div>
      <div className="adm-sec"><b>9 Relationships</b>
        {(d.relationships ?? []).map((r: any) => <div key={r.aId + r.bId}>{r.otherName} ({r.type}) trust={Number(r.trust).toFixed(2)}
          <button onClick={() => run('relationship', { otherId: r.otherId, patch: { trust: 1, affection: 1, type: 'friend' } }, 'befriend')}>max</button></div>)}
        <button onClick={() => { const o = prompt('other citizen id'); if (o) run('relationship', { otherId: o, patch: { trust: 0.9, type: 'friend' } }, 'set relation'); }}>Edit relation</button></div>
      <div className="adm-sec"><b>10 Memory (incl IMPLANT FALSE MEMORY)</b>
        {(d.memories ?? []).slice(0, 10).map((m: any) => <div key={m.id} className="adm-mem">D{m.day}: {m.text}</div>)}
        <input value={memText} onChange={(e) => setMemText(e.target.value)} placeholder="memory text" style={{ width: '70%' }} />
        <label><input type="checkbox" checked={implant} onChange={(e) => setImplant(e.target.checked)} /> IMPLANT FALSE MEMORY (tagged)</label>
        <button onClick={() => { if (memText) run('memory', { text: memText, implantFalse: implant }, 'memory add'); }}>Add</button></div>
      <div className="adm-sec"><b>11 Beliefs (tagged ADMIN)</b><pre>{JSON.stringify(d.beliefs, null, 1)}</pre>
        <button onClick={() => { const cl = prompt('belief claim'); if (cl) run('belief', { subject: 'world', claim: cl, confidence: 0.9 }, 'belief implant'); }}>Implant belief</button></div>
      <div className="adm-sec"><b>12 Secrets + Goals</b><pre>{JSON.stringify({ secrets: d.secrets, goals: d.goals }, null, 1)}</pre>
        <button onClick={() => { const g = prompt('goal text'); if (g) run('goal', { text: g }, 'goal add'); }}>Add goal</button></div>
      <div className="adm-sec"><b>13 AI brain / interrogate</b><pre>{JSON.stringify(d.ai, null, 1)}</pre>
        <button onClick={() => adminApi.forceThink(id, 'Who are you?').then(() => push('OK force-think')).catch((e) => push(`FAIL: ${e}`))}>AI force-thought</button>
        <button onClick={() => run('reset-ai', {}, 'RESET AI (wipes mind)', true)} className="danger">Reset AI</button></div>
      <div className="adm-sec"><b>14 Events/Posts/Family</b><pre>{JSON.stringify({ events: d.events, posts: d.posts, family: d.family }, null, 1)}</pre></div>
      <div className="adm-sec danger-zone"><b>Danger zone</b><br />
        <button className="danger" onClick={() => run('kill', {}, 'KILL', true)}>Kill</button>
        <button onClick={() => run('revive', {}, 'revive')}>Revive</button>
        <button onClick={() => run('immortal', {}, 'toggle immortal')}>Toggle Immortal</button>
        <button onClick={() => run('clone', {}, 'clone (new UUID)')}>Clone</button>
        <button onClick={() => adminApi.possess({ citizenId: id }).then(() => { push('OK possess'); load(); }).catch((e) => push(`FAIL: ${e}`))}>Possess</button>
        <button onClick={() => adminApi.possess({ citizenId: id, release: true }).then(() => { push('OK release'); load(); }).catch((e) => push(`FAIL: ${e}`))}>Release (clean return)</button>
      </div>
      <div className="adm-sec"><b>Raw JSON</b><pre className="adm-raw">{JSON.stringify(c, null, 1)}</pre></div>
    </div>
  );
}
