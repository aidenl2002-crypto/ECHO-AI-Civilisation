// Typed fetch wrappers for the backend API contract. All optional endpoints
// degrade gracefully (return null) so dead buttons can render disabled with
// SYSTEM NOT IMPLEMENTED instead of crashing.
import { getOwnerToken } from './admin/adminApi';
import type { CityLayout } from '@echo/shared';
export type { CityLayout } from '@echo/shared';
export interface Clock { year: number; day: number; hour: number; season: string; totalHours: number; tick?: number; }
export interface GameState { clock: Clock; speed: number; paused: boolean; counts: Record<string, number>; seed?: string; cityName?: string; worldKey?: string; }
export interface CitizenSummary { id: string; name: string; age: number; job: string; wealth: number; x: number; y: number; health: number; mood: number; alive?: boolean; activity?: string; energy?: number; hunger?: number; stress?: number; homeId?: string | null; workBuildingId?: string | null; destinationBuildingId?: string | null; }
export interface CitizenDetail extends CitizenSummary {
  home?: string; personality?: Record<string, number>; skills?: Record<string, number>;
  relationships?: Array<{ id: string; name: string; score: number; type?: string; trust?: number; affection?: number }>;
  memories?: Array<{ text: string; day: number }>; activity?: string;
  goals?: string[]; events?: Array<{ text: string; day: number }>;
  employmentHistory?: Array<{ job: string; day: number }>; financialHistory?: Array<{ amount: number; day: number; note: string }>;
  family?: Array<{ id: string; name: string; relation: string }>; posts?: Array<{ text: string; day: number }>;
  alive?: boolean; deadDay?: number; causeOfDeath?: string; beliefs?: string[]; concerns?: string[];
}
export interface Building { id: string; name: string; type: string; x: number; y: number; w?: number; h?: number; ownerId?: string | null; funds?: number; capacity?: number; districtId?: string; districtName?: string; address?: string; variant?: string; footprint?: {width:number;depth:number}; height?: number; rotation?: number; entrance?: {x:number;y:number}; propertyValue?: number; rent?: number; condition?: number; desirability?: number; workerCount?: number; residentCount?: number; open?: boolean; }
export interface BuildingDetail extends Building { ownerName: string | null; residents: Array<{id:string;name:string}>; workers: Array<{id:string;name:string;job:string}>; visitors: Array<{id:string;name:string;activity:string}>; inventory: Record<string,number>; openingHours: {open:number;close:number}; revenueToday: number; customersToday: number; events: Array<{id:string;day:number;text:string}>; }
export interface SimEvent { id: string; day: number; hour: number; type: string; text: string; summary?: string }
export interface Metrics { day: number; population: number; wealth: number; gdp: number; unemployment: number; crime: number; happiness: number; inequality: number; }
export interface Article { headline: string; body: string; }
export interface Newspaper { day: number; title: string; articles: Article[]; }
export interface EchoPost { id: string; citizenId: string; citizenName: string; text: string; day: number; likes: number; replyToId?: string; }
export interface AIStatus { enabled: boolean; queue: number; model?: string; }
export interface BrainStatus { queue: number; activeRuns: number; concurrency: number; latencyP50: number; latencyP95: number; successRate: number; parseFail: number; timeouts: number; retries: number; staleDropped: number; fallbackUsed: number; byCategory: Record<string, number>; circuitOpen: boolean; loadLevel: string; online?: boolean }
export interface FeedItem { id: string; citizenId: string; type: string; inputSummary: string; decision: string; reason: string; result: string; at: number; latencyMs: number; }
export interface HeatItem { id: string; name: string; attention: number; class: string; lod: string; x: number; y: number; }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function tryReq<T>(path: string, init?: RequestInit): Promise<T | null> {
  try { return await req<T>(path, init); } catch { return null; }
}

export const api = {
  state: () => req<GameState>('/api/state'),
  citizens: () => req<CitizenSummary[]>('/api/citizens'),
  citizen: (id: string) => req<CitizenDetail>(`/api/citizens/${id}`),
  buildings: () => req<Building[]>('/api/buildings'),
  building: (id: string) => req<BuildingDetail>(`/api/buildings/${encodeURIComponent(id)}`),
  layout: () => req<CityLayout | null>('/api/world/layout'),
  events: (limit = 100) => req<SimEvent[]>(`/api/events?limit=${limit}`),
  metrics: () => req<Metrics[]>('/api/metrics'),
  newspaper: (day: number | string) => req<Newspaper>(`/api/newspaper/${day}`),
  echonet: () => req<EchoPost[]>('/api/echonet'),
  postEcho: (citizenId: string | null, text: string) => req<EchoPost>('/api/echonet', { method: 'POST', body: JSON.stringify({ citizenId, text }) }),
  ask: (id: string, question: string) => req<{ answer: string }>(`/api/citizen/${id}/ask`, { method: 'POST', body: JSON.stringify({ question }) }),
  aiStatus: () => req<AIStatus>('/api/ai/status'),
  god: (action: string, body: Record<string, unknown> = {}) => req<unknown>(`/api/god/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${getOwnerToken()}` }, body: JSON.stringify(body) }),
  pause: (paused: boolean) => req<unknown>('/api/pause', { method: 'POST', body: JSON.stringify({ paused }) }),
  speed: (speed: number) => req<unknown>('/api/speed', { method: 'POST', body: JSON.stringify({ speed }) }),
  step: () => req<unknown>('/api/step', { method: 'POST' }),
  save: (slot?: string) => req<unknown>('/api/save', { method: 'POST', body: JSON.stringify({ slot: slot ?? 'autosave' }) }),
  load: (slot?: string) => req<unknown>('/api/load', { method: 'POST', body: JSON.stringify({ slot: slot ?? 'autosave' }) }),
  newGame: (seed: string, cityName: string, population: number) => req<unknown>('/api/new', { method: 'POST', body: JSON.stringify({ seed, cityName, population }) }),
  debug: () => req<Record<string, unknown>>('/api/debug'),
  brainStatus: () => req<{ brain: BrainStatus; provider: Record<string, unknown>; online: boolean; intensity: number; dbBytes: number }>('/api/brain/status'),
  brainFeed: (limit = 30) => tryReq<{ live: FeedItem[] }>(`/api/brain/feed?limit=${limit}`),
  brainHeat: () => tryReq<HeatItem[]>('/api/brain/heatmap'),
  aiModels: () => tryReq<{ models: string[] }>('/api/ai/models'),
  aiRoles: () => tryReq<unknown[]>('/api/ai/roles'),
  mind: (id: string) => tryReq<Record<string, unknown>>(`/api/citizen/${id}/mind`),
  think: (citizenId: string, type = 'social') => req<Record<string, unknown>>('/api/brain/think', { method: 'POST', body: JSON.stringify({ citizenId, type }) }),
  timeline: () => tryReq<Array<{ day: number; title: string; text: string }>>('/api/timeline'),
  hall: () => tryReq<Record<string, unknown>>('/api/admin/hall'),
  slots: () => tryReq<Array<{ name: string } | string>>('/api/slots'),
  likePost: (id: string) => tryReq<unknown>(`/api/echonet/${id}/like`, { method: 'POST' }),
};
