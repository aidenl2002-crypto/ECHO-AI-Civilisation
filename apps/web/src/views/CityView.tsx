// CITY view: living map + overlays + drawers + cinematic/observer.
import React, { useEffect, useMemo, useState } from 'react';
import CityMap from '../map/CityMap3D';
import { useEcho } from '../store';
import { api, type HeatItem } from '../api';
import { Icon } from '../icons';
import { Drawer, Segmented } from '../primitives';

const OVERLAYS = [
  { v: 'none', label: 'None' }, { v: 'wealth', label: 'Wealth' }, { v: 'crime', label: 'Crime', disabled: true, title: 'SYSTEM NOT IMPLEMENTED: mapped crime locations are unavailable' },
  { v: 'happiness', label: 'Mood' }, { v: 'ai', label: 'AI' },
];

export default function CityView() {
  const e = useEcho();
  const [heat, setHeat] = useState<HeatItem[]>([]);
  const [hover, setHover] = useState<{ kind: string; title: string; sub: string; x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState<string[]>(() => JSON.parse(localStorage.getItem('echo_pins') ?? '[]'));
  const [ov, setOv] = useState('none');
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => { localStorage.setItem('echo_pins', JSON.stringify(pinned)); }, [pinned]);
  useEffect(() => {
    let live = true;
    const load = () => api.brainHeat().then((h) => { if (live && h) setHeat(h); }).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const selC = e.citizens.find((c) => c.id === e.selCitizen) ?? null;
  const selB = e.buildings.find((b) => b.id === e.selBuilding) ?? null;
  const routeTo = useMemo(() => {
    if (selC && selB) return { x: selB.x, y: selB.y, label: selB.name };
    return null;
  }, [selC, selB]);

  const togglePin = (id: string) => setPinned((pins) => pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id].slice(0, 30));

  return (
    <div className="map-stage">
      <CityMap citizens={e.citizens} buildings={e.buildings} clock={e.state?.clock ?? null}
        overlay={ov} heat={heat} selectedCitizenId={e.selCitizen} selectedBuildingId={e.selBuilding}
        follow={e.follow} cinematic={e.cinematic} observer={e.observer} pinned={pinned} routeTo={routeTo}
        onSelectCitizen={e.setSelCitizen} onSelectBuilding={e.setSelBuilding} onHover={setHover} />

      <div className="map-hud tl map-title-card" style={{ maxWidth: 'min(300px, calc(100% - 36px))', boxSizing: 'border-box' }}>
        <span className="map-eyebrow">THE LIVING CITY <span className="map-live-dot" /></span>
        <strong>{e.state?.cityName || 'Project Echo'}</strong>
        <span className="map-title-sub">{e.derived.pop} people · {e.buildings.length} places <span>·</span> {e.state?.clock.season ?? ''} {String(e.state?.clock.hour ?? 0).padStart(2, '0')}:00{e.state?.paused ? ' · Paused' : ''}</span>
      </div>
      <div className="map-hud tr map-overlay-control" style={{ top: 116, right: 16 }}>
        <span className="map-control-label">MAP LAYER</span>
        <Segmented value={ov} onChange={(v) => { setOv(v); e.setOverlay(v); }} options={OVERLAYS} />
        {ov !== 'none' && <span className="map-overlay-note">{ov === 'wealth' ? 'Green: more wealth · Coral: less' : ov === 'happiness' ? 'Green: happier · Coral: struggling' : 'Violet: active cognition'}</span>}
      </div>
      <div className="map-hud bl map-toolbar">
        <button className={e.follow ? 'active' : ''} title="Follow selected (F)" onClick={() => e.setFollow(!e.follow)}><Icon name="eye" size={15} /><span>Follow</span></button>
        <button className={e.cinematic ? 'active' : ''} title="Cinematic mode" onClick={() => e.setCinematic(!e.cinematic)}><Icon name="film" size={15} /><span>Cinema</span></button>
        <button className={e.observer ? 'active' : ''} title="Observer drift" onClick={() => e.setObserver(!e.observer)}><Icon name="globe" size={15} /><span>Explore</span></button>
        <button className={showLegend ? 'active' : ''} title="Legend" onClick={() => setShowLegend((s) => !s)}><span className="map-help-icon">?</span><span>Key</span></button>
      </div>

      {showLegend && (
        <div className="map-hud map-legend-card" style={{ right: 16, bottom: 58 }}>
          <div className="legend">
            <strong>Places & people</strong>
            <div><i style={{ background: '#d98f77' }} />Homes</div>
            <div><i style={{ background: '#9a9db9' }} />Workplaces</div>
            <div><i style={{ background: '#d8a65e' }} />Shops & cafés</div>
            <div><i style={{ background: '#bd8876' }} />Civic spaces</div>
            <div><i style={{ background: '#78aea6' }} />Care & health</div>
            <div><i style={{ background: '#9aaba9' }} />Industry</div>
            <div><i style={{ background: '#408d84', borderRadius: '50%' }} />Citizen <span style={{ color: '#9369a6' }}>◌ Thinking</span></div>
          </div>
        </div>
      )}

      {hover && (
        <div className="hover-tip map-tooltip" style={{ left: Math.min(hover.x + 14, 400), top: hover.y + 14 }}>
          <b>{hover.title}</b><div className="dim">{hover.sub}</div>
        </div>
      )}

      {e.follow && selC && (
        <div className="follow-hud">
          <Icon name="eye" size={13} /><b>Following {selC.name}</b>
          <span className="dim">{selC.activity ?? '—'}</span>
          <button className="ghost" onClick={() => e.setFollow(false)}>unfollow</button>
        </div>
      )}

      {e.cinematic && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 42, background: 'rgba(35,51,46,.93)', zIndex: 14 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 42, background: 'rgba(35,51,46,.93)', zIndex: 14 }} />
        </>
      )}

      {(selC || selB) && (
        <div className="drawer-ov">
          <Drawer title={selC ? selC.name : selB?.name ?? ''} onClose={() => { e.setSelCitizen(null); e.setSelBuilding(null); }}>
            {selC && (
              <div>
                <div className="kv"><span>job</span><b>{/^j_/.test(selC.job) ? 'City worker' : selC.job}</b><span>wealth</span><b>${Math.round(selC.wealth).toLocaleString()}</b>
                  <span>mood</span><b>{Math.round(selC.mood ?? 50)}</b><span>health</span><b>{Math.round(selC.health ?? 80)}</b>
                  <span>doing</span><b>{selC.activity ?? '—'}</b><span>id</span><b className="mono">{selC.id.slice(0, 8)}</b></div>
                <div className="row wrap" style={{ marginTop: 10 }}>
                  <button onClick={() => e.setView('people')}>Full profile</button>
                  <button className={e.follow ? 'active' : ''} onClick={() => e.setFollow(!e.follow)}>{e.follow ? 'Unfollow' : 'Follow'}</button>
                  <button onClick={() => togglePin(selC.id)}>{pinned.includes(selC.id) ? 'Unpin' : 'Pin'}</button>
                </div>
              </div>
            )}
            {selB && !selC && (
              <div>
                <div className="kv"><span>type</span><b>{selB.type}</b><span>pos</span><b className="mono">{Math.round(selB.x)}, {Math.round(selB.y)}</b></div>
                <div className="row wrap" style={{ marginTop: 10 }}>
                  <button onClick={() => togglePin(selB.id)}>{pinned.includes(selB.id) ? 'Unpin' : 'Pin'}</button>
                  <button onClick={() => e.setView('business')}>Businesses</button>
                </div>
              </div>
            )}
          </Drawer>
        </div>
      )}
    </div>
  );
}
