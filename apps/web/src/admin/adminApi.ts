// Admin auth + typed fetch wrappers for /api/admin/*. Token in localStorage.
import { useCallback, useEffect, useState } from 'react';

const KEY = 'echo_owner_token';
export const getOwnerToken = (): string => localStorage.getItem(KEY) ?? '';
export const setOwnerToken = (t: string): void => {
  if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('echo-owner-token-change'));
};
export const hasOwnerToken = (): boolean => getOwnerToken().length > 0;

export function useOwnerAccess(): { token: string; role: string | null; checking: boolean; error: string | null } {
  const [token, setToken] = useState(getOwnerToken);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const update = (): void => setToken(getOwnerToken());
    window.addEventListener('echo-owner-token-change', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('echo-owner-token-change', update); window.removeEventListener('storage', update); };
  }, []);
  useEffect(() => {
    if (!token) { setRole(null); setChecking(false); setError(null); return; }
    let active = true;
    setChecking(true);
    setRole(null);
    setError(null);
    adminApi.whoami().then((identity) => {
      if (active) { setRole(identity.role); setChecking(false); }
    }).catch((cause) => {
      if (active) { setError(cause instanceof Error ? cause.message : String(cause)); setChecking(false); }
    });
    return () => { active = false; };
  }, [token]);
  return { token, role, checking, error };
}

async function areq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOwnerToken()}`, ...(init?.headers || {}) },
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED — set OWNER_TOKEN (top-right God Key)');
  if (res.status === 403) throw new Error(`FORBIDDEN — ${(await res.json().catch(() => ({ error: 'forbidden' }))).error}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(await res.json().catch(() => ({}))).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown = {}): Promise<T> =>
  areq<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const adminApi = {
  whoami: () => areq<{ role: string; permissions: string[] }>('/api/admin/whoami'),
  citizens: (q = '', sort = 'wealth', order = 'desc', limit = 100) =>
    areq<Array<Record<string, unknown>>>(`/api/admin/citizens?q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&limit=${limit}`),
  full: (id: string) => areq<Record<string, any>>(`/api/admin/citizens/${id}/full`),
  op: (id: string, op: string, body: unknown = {}) => post(`/api/admin/citizens/${id}/${op}`, body),
  money: (id: string, amount: number, reason = '') => post(`/api/admin/citizens/${id}/money`, { amount, reason }),
  spawn: (body: unknown = {}) => post('/api/admin/citizens/spawn', body),
  preset: (preset: string) => post('/api/admin/citizens/preset', { preset }),
  extinction: (body: unknown = {}) => post('/api/admin/extinction', body),
  miracle: (kind: string) => post('/api/admin/miracle', { kind }),
  moneyDrop: (amount: number, count = 20) => post('/api/admin/money-drop', { amount, count }),
  nuke: (factor = 0.1) => post('/api/admin/nuke-economy', { factor }),
  chaos: (kind: string) => post('/api/admin/chaos', { kind }),
  pick: (kind: string) => post('/api/admin/pick', { kind }),
  possess: (body: unknown = {}) => post('/api/admin/possess', body),
  businesses: () => areq<Array<Record<string, any>>>('/api/admin/businesses'),
  bizAdmin: (id: string, body: unknown = {}) => post(`/api/admin/businesses/${id}/admin`, body),
  bizSpawn: (body: unknown = {}) => post('/api/admin/businesses/spawner', body),
  tycoon: (citizenId: string) => post('/api/admin/businesses/tycoon', { citizenId }),
  economy: () => areq<Record<string, any>>('/api/admin/economy'),
  economySet: (body: unknown = {}) => post('/api/admin/economy', body),
  effect: (body: unknown = {}) => post('/api/admin/effects', body),
  government: () => areq<Record<string, any>>('/api/admin/government'),
  govSet: (body: unknown = {}) => post('/api/admin/government', body),
  law: (text: string) => post('/api/admin/government/law', { text }),
  election: (forceWinner?: string) => post('/api/admin/government/election', { forceWinner }),
  arrest: (citizenId: string) => post('/api/admin/crime/arrest', { citizenId }),
  release: (citizenId: string) => post('/api/admin/crime/release', { citizenId }),
  rumour: (text: string, count = 5) => post('/api/admin/rumour', { text, count }),
  secretGen: () => post('/api/admin/secret-gen', {}),
  eventSpawn: (type: string, summary: string) => post('/api/admin/event-spawn', { type, summary }),
  snapshots: () => areq<Array<Record<string, any>>>('/api/admin/snapshots'),
  snapCreate: (name: string) => post('/api/admin/snapshots', { name }),
  snapRestore: (name: string) => post(`/api/admin/snapshots/${name}/restore`, {}),
  snapDelete: (name: string) => areq(`/api/admin/snapshots/${name}`, { method: 'DELETE' }),
  snapDup: (name: string) => post(`/api/admin/snapshots/${name}/duplicate`, {}),
  time: (body: unknown = {}) => post('/api/admin/time', body),
  step: (n = 1) => post('/api/admin/time/step', { n }),
  runUntil: (body: unknown = {}) => post('/api/admin/time/run-until', body),
  invariants: () => areq<{ checks: Array<{ check: string; ok: boolean; detail: string }>; moneySupply: number }>('/api/admin/invariant-check'),
  verify: () => post('/api/admin/verify-world', {}),
  database: () => areq<Record<string, any>>('/api/admin/database'),
  system: () => areq<Record<string, any>>('/api/admin/system'),
  aiPause: () => post('/api/admin/ai/pause', {}),
  aiResume: () => post('/api/admin/ai/resume', {}),
  forceThink: (citizenId: string, prompt = '') => post('/api/admin/ai/force-think', { citizenId, prompt }),
  command: (text: string) => post<{ ok: boolean; summary: string; actions: Array<{ type: string }>; warnings: string[] }>('/api/admin/command', { text }),
  audit: (limit = 100) => areq<{ live: Array<Record<string, any>>; persisted: Array<Record<string, any>> }>(`/api/admin/audit?limit=${limit}`),
  hall: () => areq<Record<string, any>>('/api/admin/hall'),
};

export function useToasts(): { toasts: string[]; push: (t: string) => void } {
  const [toasts, setToasts] = useState<string[]>([]);
  const push = useCallback((t: string) => {
    setToasts((l) => [t, ...l].slice(0, 6));
    setTimeout(() => setToasts((l) => l.slice(0, 5)), 5000);
  }, []);
  return { toasts, push };
}
