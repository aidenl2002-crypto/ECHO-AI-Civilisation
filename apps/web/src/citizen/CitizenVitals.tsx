import React from 'react';
import './citizen.css';
export function CitizenVitals({ health, happiness, energy, hunger, stress }: {health?: number; happiness?: number; energy?: number; hunger?: number; stress?: number}) {
  const rows = [{label:'Health',value:health},{label:'Happiness',value:happiness},{label:'Energy',value:energy},{label:'Fullness',value:hunger},{label:'Stress',value:stress,inverse:true}];
  return <div className="citizen-vitals">{rows.map(row => <div key={row.label}><div className="citizen-vital-head"><span>{row.label}</span><b>{typeof row.value === 'number' && Number.isFinite(row.value) ? Math.round(row.value) : '—'}</b></div><div className="citizen-vital-track"><i style={{width:`${Math.max(0,Math.min(100,row.value ?? 0))}%`,background:row.inverse ? '#c79071' : undefined}} /></div></div>)}</div>;
}
