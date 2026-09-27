import React from 'react';
import type { CitizenSummary } from '../api';
import { useEcho } from '../store';
import { CitizenVitals } from './CitizenVitals';

export function FollowLifePanel({ citizen }: {citizen: CitizenSummary & {energy?:number;hunger?:number;stress?:number;homeId?:string|null;workBuildingId?:string|null;destinationBuildingId?:string|null}}) {
  const e = useEcho();
  const place = (id?:string|null) => id ? e.buildings.find(b => b.id === id)?.name ?? id : null;
  return <section className="citizen-follow-life" aria-label="Follow this life"><div className="citizen-section-label">A life in motion</div><p><strong>{citizen.name}</strong> · {citizen.activity ?? 'Activity unrecorded'}</p>{citizen.destinationBuildingId && <p>Heading to {place(citizen.destinationBuildingId)}</p>}<p>Home: {place(citizen.homeId) ?? 'Not recorded'}<br/>Work: {place(citizen.workBuildingId) ?? citizen.job}</p><CitizenVitals health={citizen.health} happiness={citizen.mood} energy={citizen.energy} hunger={citizen.hunger} stress={citizen.stress == null ? undefined : citizen.stress * 100}/></section>;
}
