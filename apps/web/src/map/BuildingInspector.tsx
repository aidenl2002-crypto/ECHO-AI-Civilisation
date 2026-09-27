import React, { useEffect, useState } from 'react';
import { api, type BuildingDetail } from '../api';
import { useEcho } from '../store';
import { Bar } from '../primitives';

export function BuildingInspector({ id }: { id: string }) {
  const e = useEcho();
  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setBuilding(null);
    setError('');
    const load = () => api.building(id).then((b) => { if (active) { setBuilding(b); setError(''); } }).catch(() => { if (active) setError('Unable to update this place.'); });
    load(); const timer = setInterval(load, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [id]);
  if (!building) return <p className="dim">{error || 'Opening the doors…'}</p>;
  const b = building;
  const inspect = (citizenId: string) => { e.setSelCitizen(citizenId); e.setSelBuilding(null); e.setView('people'); };
  return <div className="building-inspector">
    <span className="chip">{(b.variant ?? b.type).replace(/_/g, ' ')}</span>
    <p className="dim">{b.address ?? 'Address not recorded'}<br/>{b.districtName ?? 'Original city'}</p>
    <div className="kv"><span>Status</span><b>{b.type === 'home' ? 'Residential' : b.open ? 'Open now' : 'Closed now'}</b>
      <span>Owner</span><b>{b.ownerName ?? 'City / unassigned'}</b>
      {b.type !== 'home' && <><span>Opening hours</span><b>{b.openingHours.open === b.openingHours.close ? '24 hours' : `${String(b.openingHours.open).padStart(2,'0')}:00 – ${String(b.openingHours.close).padStart(2,'0')}:00`}</b></>}
      <span>Capacity</span><b>{b.capacity ?? '—'}</b>
      {b.propertyValue != null && <><span>Property value</span><b>${b.propertyValue.toLocaleString()}</b></>}
      {b.rent != null && b.type === 'home' && <><span>Monthly rent</span><b>${b.rent.toLocaleString()}</b></>}
      {b.type !== 'home' && <><span>Business funds</span><b>${Math.round(b.funds ?? 0).toLocaleString()}</b><span>Revenue today</span><b>${b.revenueToday.toLocaleString()}</b><span>Customers today</span><b>{b.customersToday}</b></>}
    </div>
    {b.condition != null && <Bar label="Condition" value={b.condition} />}
    <div className="sec-h">At this location · {b.visitors.length}</div>
    {b.visitors.slice(0, 12).map((c) => <button className="building-person" key={c.id} onClick={() => inspect(c.id)}>{c.name}<span>{c.activity}</span></button>)}
    {b.visitors.length === 0 && <p className="faint">No citizens at this location at the moment.</p>}
    <div className="sec-h">{b.type === 'home' ? 'Household' : 'Staff'} · {b.type === 'home' ? b.residents.length : b.workers.length}</div>
    {(b.type === 'home' ? b.residents : b.workers).slice(0, 18).map((c) => <button className="building-person" key={c.id} onClick={() => inspect(c.id)}>{c.name}<span>{'job' in c ? String(c.job) : 'Resident'}</span></button>)}
    {Object.keys(b.inventory).length > 0 && <><div className="sec-h">Stock</div><div className="kv">{Object.entries(b.inventory).map(([item, quantity]) => <React.Fragment key={item}><span>{item}</span><b>{quantity}</b></React.Fragment>)}</div></>}
    {b.events.length > 0 && <><div className="sec-h">Recent history</div>{b.events.slice(0, 5).map((event) => <div className="ev-card" key={event.id}><span className="faint">Day {event.day} · </span>{event.text}</div>)}</>}
    {error && <p role="status" className="dim">{error}</p>}
  </div>;
}
