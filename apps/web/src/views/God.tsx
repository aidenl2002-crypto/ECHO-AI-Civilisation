// Owner controls: guided interventions and the full administration console.
import React, { useState } from 'react';
import AdminConsole from '../admin/AdminConsole';
import { adminApi, setOwnerToken, useOwnerAccess, useToasts } from '../admin/adminApi';
import { api } from '../api';
import { useEcho } from '../store';
import { Modal } from '../primitives';
import { Icon } from '../icons';

interface Chaos { id: string; title: string; desc: string; danger?: boolean; run: (note: string) => Promise<string> }

export default function GodView() {
  const e = useEcho();
  const { push } = useToasts();
  const [arm, setArm] = useState<Chaos | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const access = useOwnerAccess();
  const authed = access.role === 'OWNER';

  const say = (t: string) => { setLog((l) => [`${new Date().toLocaleTimeString()} ${t}`, ...l].slice(0, 30)); push(t); };

  const CHAOS: Chaos[] = [
    { id: 'boom', title: 'Economic boom', desc: 'Bring a wave of confidence to local markets.', run: async () => { await api.god('boom'); return 'boom invoked ✓'; } },
    { id: 'recession', title: 'Recession', desc: 'Send the economy into a downturn.', run: async () => { await api.god('recession'); return 'recession invoked ✓'; } },
    { id: 'outbreak', title: 'Outbreak', desc: 'Introduce an illness across the city.', danger: true, run: async () => { await api.god('outbreak'); return 'outbreak released ✓'; } },
    { id: 'migrant', title: 'Welcome newcomers', desc: 'Bring new residents into Echo City.', run: async () => { await api.god('add-migrant'); return 'migrants arriving ✓'; } },
    { id: 'money', title: 'Money drop', desc: 'Distribute funds to ten citizens.', run: async () => { await adminApi.moneyDrop(1000, 10); return 'money drop ✓'; } },
    { id: 'tycoon', title: 'Create a tycoon', desc: 'Give a randomly chosen citizen a fortune.', run: async (n) => { const r = await adminApi.pick('champion') as { id?: string }; if (r?.id) await adminApi.tycoon(r.id); return `tycoon crowned ${n || ''} ✓`; } },
    { id: 'miracle', title: 'Miracle', desc: 'Add a remarkable event to city life.', run: async () => { await adminApi.miracle('blessing'); return 'miracle ✓'; } },
    { id: 'revive', title: 'Revive all', desc: 'Bring back every citizen the city has lost.', run: async () => { await adminApi.miracle('revive-all'); return 'revived ✓'; } },
    { id: 'nuke', title: 'Crash the economy', desc: 'Reduce the economy to 10% of its current size.', danger: true, run: async () => { await adminApi.nuke(0.1); return 'economy nuked ✓'; } },
    { id: 'extinction', title: 'End all lives', desc: 'Kill every citizen. This cannot be undone.', danger: true, run: async () => { const r = await adminApi.extinction({ confirm: 'EXTINCTION' }) as { killed: number }; return `extinction: ${r.killed} killed`; } },
  ];

  const exec = async () => {
    if (!arm) return;
    setBusy(true);
    try { say(await arm.run(note)); e.refresh(); }
    catch (err) { say(`FAIL ${arm.id}: ${err instanceof Error ? err.message : err}`); }
    setBusy(false); setArm(null); setNote('');
  };

  return (
    <div className="view">
      <div className="god-wrap">
        <div className="view-h"><span className="view-kicker">Owner studio</span><h1>Shape the story.</h1><p className="view-summary">Introduce events, support citizens or change the course of Echo City. Every intervention is recorded.</p></div>
        <div className="god-banner god-overview">
          <Icon name="eye" size={26} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Interventions</div>
            <div className="dim" style={{ fontSize: 12 }}>
              {authed ? 'Owner access active. Your changes will appear in the city audit.' : access.checking ? 'Checking owner key…' : access.error ? 'That key was not accepted. Check the OWNER_TOKEN in your local .env file.' : 'Enter your owner key to unlock these controls.'}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <label className="god-key-entry">
            <span>Owner key</span>
            <input type="password" value={access.token} onChange={(event) => setOwnerToken(event.target.value)} placeholder="Paste OWNER_TOKEN" autoComplete="off" aria-label="Owner key" />
          </label>
          <span className="chip mono">{e.derived.pop} residents · Day {e.state?.clock.day}</span>
        </div>

        <div className="sec-h god-section">Choose an event</div>
        <div className="chaos-grid">
          {CHAOS.map((c) => (
            <div key={c.id} className={c.danger ? 'chaos-card chaos-card-danger' : 'chaos-card'}>
              <h4>{c.danger && <Icon name="flame" size={13} />}{c.title}</h4>
              <p>{c.desc}</p>
              <button className={c.danger ? 'danger' : ''} disabled={!authed} title={authed ? c.title : 'Owner key required'}
                onClick={() => setArm(c)}>Choose event</button>
            </div>
          ))}
        </div>

        {log.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="sec-h god-section">This session</div>
            {log.map((l, i) => <div key={i} className="mono dim" style={{ fontSize: 12 }}>{l}</div>)}
          </div>
        )}

        {arm && (
          <Modal title={`${arm.danger ? '⚠ ' : ''}Confirm: ${arm.title}`} danger={arm.danger} onClose={() => setArm(null)}>
            <p className="dim">{arm.desc}</p>
            {arm.id === 'extinction' && <p>Type <b className="mono">EXTINCTION</b> in the reason box to arm.</p>}
            <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>Reason (audited)
              <input value={note} onChange={(x) => setNote(x.target.value)} placeholder="Why make this change?" autoFocus />
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button className={arm.danger ? 'danger' : ''} disabled={busy || (arm.id === 'extinction' && note !== 'EXTINCTION')}
                onClick={exec}>{busy ? 'Applying…' : `Apply ${arm.title}`}</button>
              <button className="ghost" onClick={() => setArm(null)}>Cancel</button>
            </div>
          </Modal>
        )}

        <div className="sec-h god-section">Detailed controls</div>
        {authed ? <div style={{ border: '1px solid #e6e3da', borderRadius: 16, overflow: 'hidden' }}><AdminConsole /></div> :
          <div className="god-locked">Enter the owner key above to open City studio.</div>}
      </div>
    </div>
  );
}
