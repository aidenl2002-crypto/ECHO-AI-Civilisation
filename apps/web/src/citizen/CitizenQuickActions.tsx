import React, { useRef, useState } from 'react';
import { adminApi, useOwnerAccess } from '../admin/adminApi';
import './citizen.css';

export function CitizenQuickActions({ id, name = 'this citizen', alive = true, onChanged, onOpenEditor }: {
  id: string; name?: string; alive?: boolean; onChanged?: () => void; onOpenEditor?: () => void;
}) {
  const access = useOwnerAccess();
  const lock = useRef(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [amount, setAmount] = useState('1000');
  const run = async (label: string, action: () => Promise<unknown>, confirm?: string) => {
    if (lock.current || access.role !== 'OWNER') return;
    if (confirm && !window.confirm(confirm)) return;
    lock.current = true; setBusy(label); setMessage(''); setFailed(false);
    try {
      const result = await action() as { enqueued?: string | null };
      setMessage(label === 'Reflect' ? (result.enqueued ? 'Reflection queued. Watch the Mind tab for its outcome.' : 'Prompt recorded; AI did not accept a new request. Check AI Brain status.') : `${label} completed.`);
      onChanged?.();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { lock.current = false; setBusy(''); }
  };
  if (access.role !== 'OWNER') return <div className="citizen-owner-note">{access.checking ? 'Checking owner access…' : 'Unlock owner controls in God Console to shape this life.'}</div>;
  return <section className="citizen-quick" aria-label="Citizen owner actions">
    <div className="citizen-section-label">Owner interventions</div>
    <fieldset disabled={!!busy || !alive}>
      <div className="citizen-money-action"><label>Give money<input aria-label="Amount to give citizen" type="number" min="1" max="100000000" value={amount} onChange={e => setAmount(e.target.value)} /></label><button disabled={!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 100000000} onClick={() => run('Give money', () => adminApi.money(id, Number(amount), 'Citizen quick action'))}>Give</button></div>
      <div className="citizen-action-grid">
        <button onClick={() => run('Heal', () => adminApi.op(id, 'heal'))}>Heal</button>
        <button onClick={() => run('Lift mood', () => adminApi.op(id, 'mood', { joy: 1, happiness: 100 }))}>Lift mood</button>
        <button onClick={() => run('Reflect', () => adminApi.forceThink(id, 'Reflect on your current life, relationships and goals.'))}>Ask to reflect</button>
        <button onClick={() => run('Find work', () => adminApi.op(id, 'job'), `Assign ${name} to an available job? This replaces their current job.`)}>Find work</button>
        <button onClick={() => run('End employment', () => adminApi.op(id, 'fire'), `End ${name}'s current employment?`)}>End employment</button>
      </div>
    </fieldset>
    {onOpenEditor && <button disabled={!!busy} onClick={onOpenEditor}>Open full editor</button>}
    {busy && <p role="status">{busy}…</p>}
    {message && <p className={failed ? 'citizen-action-error' : 'citizen-action-result'} role={failed ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
