// ECHO OS living city map — polished canvas engine (no dependency).
// Roads/blocks/parks/districts, procedural buildings, day/night + seasons,
// LOD, interpolated movement, overlays, hover/click, follow/route/cinematic/observer.
import React, { useEffect, useRef, useState } from 'react';
import type { Building, CitizenSummary, Clock, HeatItem } from '../api';

export interface MapSelection { citizenId: string | null; buildingId: string | null }

interface Props {
  citizens: CitizenSummary[];
  buildings: Building[];
  clock: Clock | null;
  overlay: string;
  heat: HeatItem[];
  selectedCitizenId: string | null;
  selectedBuildingId: string | null;
  follow: boolean;
  cinematic: boolean;
  observer: boolean;
  pinned: string[];
  routeTo: { x: number; y: number; label: string } | null;
  onSelectCitizen: (id: string | null) => void;
  onSelectBuilding: (id: string | null) => void;
  onHover: (h: { kind: string; title: string; sub: string; x: number; y: number } | null) => void;
}

const TYPE_STYLE: Record<string, { body: string; roof: string; trim: string }> = {
  house: { body: '#d98f77', roof: '#f2c0a7', trim: '#a85642' }, apartment: { body: '#ce816f', roof: '#edac93', trim: '#a35648' }, home: { body: '#d98f77', roof: '#f2c0a7', trim: '#a85642' },
  shop: { body: '#d8a65e', roof: '#f4d59b', trim: '#a77a35' }, market: { body: '#d8a65e', roof: '#f4d59b', trim: '#a77a35' }, business: { body: '#9a9db9', roof: '#c7c9d7', trim: '#747891' },
  office: { body: '#9a9db9', roof: '#c7c9d7', trim: '#747891' }, commercial: { body: '#9a9db9', roof: '#c7c9d7', trim: '#747891' },
  factory: { body: '#9aaba9', roof: '#cad4ce', trim: '#718681' }, industrial: { body: '#9aaba9', roof: '#cad4ce', trim: '#718681' },
  hospital: { body: '#78aea6', roof: '#b9d9cd', trim: '#497f7a' }, clinic: { body: '#78aea6', roof: '#b9d9cd', trim: '#497f7a' },
  school: { body: '#a8b884', roof: '#d8deb2', trim: '#798d5c' }, police: { body: '#829daf', roof: '#c0d4d9', trim: '#57798d' },
  hall: { body: '#bd8876', roof: '#e6b9a2', trim: '#92594b' }, civic: { body: '#bd8876', roof: '#e6b9a2', trim: '#92594b' },
  park: { body: '#86ad7f', roof: '#b6cf9d', trim: '#668c5c' }, farm: { body: '#86ad7f', roof: '#b6cf9d', trim: '#668c5c' },
  hotel: { body: '#c89b78', roof: '#ecc6a1', trim: '#9e7057' }, hospitality: { body: '#c89b78', roof: '#ecc6a1', trim: '#9e7057' }, bar: { body: '#c89b78', roof: '#ecc6a1', trim: '#9e7057' },
};
function styleFor(type: string) {
  return TYPE_STYLE[(type || '').toLowerCase()] ?? { body: '#baa89c', roof: '#ded0bf', trim: '#89796e' };
}

const DISTRICTS = ['Old Town', 'Harbour', 'Northgate', 'Foundry', 'Palms', 'University', 'Market Row', 'Hillcrest', 'Docks'];
function districtAt(x: number, y: number): string {
  const cx = Math.min(2, Math.floor(x / 340)), cy = Math.min(2, Math.floor(y / 340));
  return DISTRICTS[cy * 3 + cx] ?? 'Outskirts';
}

/** darkness 0 (noon) .. 1 (midnight) */
export function darknessAt(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h <= 17) return 0;
  if (h >= 18 && h <= 20) return (h - 18) / 2 * 0.55;
  if (h >= 5 && h < 7) return (1 - (h - 5) / 2) * 0.55;
  return 0.55 + 0.45 * Math.cos(((h >= 21 ? h - 21 : h + 3) / 9) * Math.PI);
}

function seasonTint(season: string): string {
  switch ((season || '').toLowerCase()) {
    case 'spring': return 'rgba(150,190,127,0.055)';
    case 'summer': return 'rgba(245,188,105,0.055)';
    case 'autumn': case 'fall': return 'rgba(204,119,72,0.07)';
    case 'winter': return 'rgba(142,167,183,0.08)';
    default: return 'rgba(0,0,0,0)';
  }
}

export default function CityMap(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState({ x: 500, y: 500, z: 1.15 });
  const camRef = useRef(cam);
  const tgtRef = useRef(cam);
  const dragRef = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null);
  const posRef = useRef(new Map<string, { x: number; y: number }>());
  const propsRef = useRef(p);
  propsRef.current = p;
  const [hud, setHud] = useState({ z: 1.15 });

  // camera target: follow / observer / cinematic drift
  useEffect(() => {
    if (p.follow && p.selectedCitizenId) {
      const c = p.citizens.find((x) => x.id === p.selectedCitizenId);
      if (c) tgtRef.current = { ...tgtRef.current, x: c.x, y: c.y };
    }
  }, [p.follow, p.selectedCitizenId, p.citizens]);

  const focus = (x: number, y: number, z?: number) => {
    tgtRef.current = { x, y, z: z ?? Math.max(tgtRef.current.z, 1.4) };
  };
  (CityMap as unknown as { focusCity?: (x: number, y: number, z?: number) => void }).focusCity = focus;

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, t = 0, frame = 0;
    const heatById = new Map<string, HeatItem>();

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(300, r.width * dpr);
      canvas.height = Math.max(200, r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const render = () => {
      t += 0.016;
      const pr = propsRef.current;
      heatById.clear();
      for (const h of pr.heat) heatById.set(h.id, h);

      // ease camera toward target
      const c = camRef.current, tg = tgtRef.current;
      if (pr.observer && !pr.follow) {
        tg.x = 500 + Math.sin(t * 0.05) * 320;
        tg.y = 500 + Math.cos(t * 0.037) * 320;
        tg.z += (0.75 - tg.z) * 0.01;
      }
      if (pr.cinematic) {
        tg.x = 500 + Math.sin(t * 0.11) * 130;
        tg.y = 500 + Math.cos(t * 0.09) * 130;
        tg.z += (1.6 - tg.z) * 0.005;
      }
      c.x += (tg.x - c.x) * 0.12; c.y += (tg.y - c.y) * 0.12; c.z += (tg.z - c.z) * 0.12;
      camRef.current = { ...c };
      if (++frame % 30 === 0) setCam({ ...c });

      const W = canvas.width, H = canvas.height, z = c.z * (W / 1100);
      const dark = darknessAt(pr.clock?.hour ?? 12);
      const toS = (wx: number, wy: number): [number, number] => [(wx - c.x) * z + W / 2, (wy - c.y) * z + H / 2];

      // Sun-washed ground and soft neighbourhood blocks.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f5f2e9'); g.addColorStop(1, '#eae9dc');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // Blocks, courtyards, and planted public squares.
      for (let bx = 0; bx < 10; bx++) for (let by = 0; by < 10; by++) {
        const [sx, sy] = toS(bx * 100 + 50, by * 100 + 50);
        const s = 100 * z;
        if (sx < -s || sy < -s || sx > W + s || sy > H + s) continue;
        const isPark = (bx * 7 + by * 13) % 11 === 0;
        ctx.fillStyle = isPark ? '#b6d29e' : (bx + by) % 3 === 0 ? '#eae5d4' : '#eee9d9';
        ctx.fillRect(sx - s / 2 + 5 * z, sy - s / 2 + 5 * z, s - 10 * z, s - 10 * z);
        if (isPark) {
          // Meandering path and groves give the map depth even at overview scale.
          ctx.strokeStyle = '#f8f4df'; ctx.lineWidth = Math.max(1, 5 * z);
          ctx.beginPath(); ctx.moveTo(sx - s * .42, sy + s * .17); ctx.quadraticCurveTo(sx, sy - s * .16, sx + s * .41, sy + s * .13); ctx.stroke();
          for (let k = 0; k < 8; k++) {
            const px = sx - s * .37 + ((k * 37) % 73) / 73 * s * .73;
            const py = sy - s * .35 + ((k * 43) % 67) / 67 * s * .70;
            const r = Math.max(2, (4 + k % 3) * z);
            ctx.fillStyle = '#8eaf83'; ctx.beginPath(); ctx.arc(px + 1.5 * z, py + 2 * z, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = k % 2 ? '#6e9b74' : '#a4c394'; ctx.beginPath(); ctx.arc(px, py, r * .85, 0, Math.PI * 2); ctx.fill();
          }
        } else if (z > .3) {
          ctx.fillStyle = '#abc597';
          for (let k = 0; k < 3; k++) {
            const px = sx - s * .34 + k * s * .31;
            const py = sy + ((bx * 3 + by + k) % 2 ? .36 : -.35) * s;
            ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, 3 * z), 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // A quiet street grid: pale paving, edge lines, and intermittent markings.
      ctx.strokeStyle = '#bdbfae'; ctx.lineWidth = Math.max(2, 13 * z);
      for (let i = 0; i <= 1000; i += 100) {
        let [x1, y1] = toS(i, 0), [x2, y2] = toS(i, 1000);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        let [ax, ay] = toS(0, i), [bx, by] = toS(1000, i);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.strokeStyle = '#f9f6e9'; ctx.lineWidth = Math.max(1, 8 * z);
      for (let i = 0; i <= 1000; i += 100) {
        const [x1, y1] = toS(i, 0), [x2, y2] = toS(i, 1000);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [ax, ay] = toS(0, i), [bx, by] = toS(1000, i);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.strokeStyle = '#c2c3b5'; ctx.lineWidth = Math.max(.5, 1 * z);
      ctx.setLineDash([4 * z, 8 * z]);
      for (let i = 0; i <= 1000; i += 100) {
        const [x1, y1] = toS(i, 0), [x2, y2] = toS(i, 1000);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [ax, ay] = toS(0, i), [bx, by] = toS(1000, i);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.setLineDash([]);

      // streetlights at intersections (night glow)
      if (dark > 0.15) {
        for (let ix = 0; ix <= 1000; ix += 200) for (let iy = 0; iy <= 1000; iy += 200) {
          const [sx, sy] = toS(ix, iy);
          if (sx < 0 || sy < 0 || sx > W || sy > H) continue;
          const r = Math.max(2, 9 * z * dark);
          const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          rg.addColorStop(0, `rgba(255,205,127,${0.5 * dark})`); rg.addColorStop(1, 'rgba(255,205,127,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Small roof plans with side walls, trim, and planted courtyards.
      const lod = c.z;
      for (const b of pr.buildings) {
        const st = styleFor(b.type);
        const bw = (b.w ?? 34) * z, bh = (b.h ?? 34) * z;
        const [sx, sy] = toS(b.x, b.y);
        if (sx < -bw || sy < -bh || sx > W + bw || sy > H + bh) continue;
        const sel = b.id === pr.selectedBuildingId;
        const lift = Math.max(3, 6 * z);
        ctx.fillStyle = 'rgba(77,72,57,.24)';
        ctx.fillRect(sx - bw / 2 + lift, sy - bh / 2 + lift * 1.5, bw, bh);
        ctx.fillStyle = st.body;
        ctx.fillRect(sx - bw / 2, sy - bh / 2 + lift, bw, bh);
        ctx.fillStyle = st.trim;
        ctx.fillRect(sx - bw / 2, sy + bh / 2, bw, lift);
        ctx.fillStyle = st.roof;
        ctx.fillRect(sx - bw / 2, sy - bh / 2, bw, bh);
        ctx.fillStyle = st.body;
        ctx.fillRect(sx - bw / 2, sy - bh / 2, bw * .48, bh);
        ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(1, 1.8 * z);
        ctx.strokeRect(sx - bw / 2, sy - bh / 2, bw, bh);
        if (bw > 13 && bh > 13) {
          // A centre ridge and bright skylights create an instantly legible roof.
          ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(1, 1.2 * z);
          ctx.beginPath(); ctx.moveTo(sx, sy - bh * .42); ctx.lineTo(sx, sy + bh * .42); ctx.stroke();
          ctx.fillStyle = 'rgba(255,253,243,.65)';
          ctx.fillRect(sx - bw * .25, sy - bh * .30, Math.max(2, bw * .17), Math.max(2, bh * .13));
          if (bw > 24) ctx.fillRect(sx + bw * .12, sy + bh * .17, Math.max(2, bw * .14), Math.max(2, bh * .12));
        }
        if (dark > .2 && bw > 12) {
          ctx.fillStyle = `rgba(255,232,159,${.25 + dark * .5})`;
          for (let wi = 0; wi < Math.min(4, Math.floor(bw / 8)); wi++)
            ctx.fillRect(sx - bw / 2 + (wi + 1) * bw / 5, sy + bh / 2 + 1, Math.max(1, 2 * z), Math.max(2, 3 * z));
        }
        // overlay tint
        const ov = overlayTint(pr, b, null);
        if (ov) { ctx.fillStyle = ov; ctx.fillRect(sx - bw / 2, sy - bh / 2, bw, bh); }
        if (sel || pr.pinned.includes(b.id)) {
          ctx.strokeStyle = sel ? '#27332f' : '#ca8c49'; ctx.lineWidth = Math.max(2, 2 * z);
          ctx.strokeRect(sx - bw / 2 - 4, sy - bh / 2 - 4, bw + 8, bh + 8);
        }
        if (lod > 1.15) {
          ctx.fillStyle = '#42544b';
          ctx.font = `600 ${Math.max(10, 10 * z)}px 'DM Sans', sans-serif`;
          ctx.fillText(b.name.slice(0, 18), sx - bw / 2, sy - bh / 2 - 6);
        }
      }

      // district labels at far zoom
      if (lod < 0.62) {
        ctx.fillStyle = 'rgba(68,87,74,.56)';
        ctx.font = `600 ${13 * (W / 1100) + 8}px 'DM Sans', sans-serif`;
        ctx.textAlign = 'center';
        for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++)
          { const [sx, sy] = toS(dx * 340 + 170, dy * 340 + 170); ctx.fillText(districtAt(dx * 340 + 170, dy * 340 + 170).toUpperCase(), sx, sy); }
        ctx.textAlign = 'left';
      }

      // route line + ETA
      const rc = pr.citizens.find((x) => x.id === pr.selectedCitizenId);
      if (rc && pr.routeTo) {
        const [ax, ay] = toS(rc.x, rc.y), [bx, by] = toS(pr.routeTo.x, pr.routeTo.y);
        ctx.strokeStyle = '#258b80'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.setLineDash([]);
        const dist = Math.hypot(pr.routeTo.x - rc.x, pr.routeTo.y - rc.y);
        const etaH = dist / 42;
        ctx.fillStyle = '#236f68'; ctx.font = `600 ${11 * (W / 1100) + 7}px 'DM Sans'`;
        ctx.fillText(`ETA ${etaH < 1 ? Math.round(etaH * 60) + 'm' : etaH.toFixed(1) + 'h'} → ${pr.routeTo.label}`, (ax + bx) / 2 + 8, (ay + by) / 2 - 8);
      }

      // citizens (interpolated, LOD)
      for (const c of pr.citizens) {
        const prev = posRef.current.get(c.id);
        const sm = prev ?? { x: c.x, y: c.y };
        sm.x += (c.x - sm.x) * 0.16; sm.y += (c.y - sm.y) * 0.16;
        posRef.current.set(c.id, sm);
        const [sx, sy] = toS(sm.x, sm.y);
        if (sx < -12 || sy < -12 || sx > W + 12 || sy > H + 12) continue;
        const sel = c.id === pr.selectedCitizenId;
        const dead = c.alive === false;
        const R = sel ? 7 : lod > 1.1 ? 5 : 3.6;
        // Soft activity halo makes individual lives visible without overpowering the city.
        const mood = c.mood ?? 50;
        ctx.fillStyle = dead ? 'rgba(173,92,84,.2)' : mood > 66 ? 'rgba(95,159,116,.25)' : mood < 33 ? 'rgba(221,119,95,.25)' : 'rgba(73,151,144,.19)';
        ctx.beginPath(); ctx.arc(sx, sy, R + 5, 0, Math.PI * 2); ctx.fill();
        // AI-thought ring
        const heat = heatById.get(c.id);
        if (heat && heat.attention > 0.5) {
          ctx.strokeStyle = `rgba(147,105,166,${0.4 + heat.attention * 0.4})`;
          ctx.lineWidth = 1.4; ctx.setLineDash([3, 2]);
          ctx.beginPath(); ctx.arc(sx, sy, R + 6 + Math.sin(t * 3) * 1.2, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        // body
        ctx.fillStyle = dead ? '#a87f78' : sel ? '#e27759' : overlayCitizen(pr, c);
        ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fffdfa'; ctx.lineWidth = Math.max(1.3, 1.8 * z);
        ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
        if (sel || pr.pinned.includes(c.id)) { ctx.strokeStyle = sel ? '#334b44' : '#c89a51'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(sx, sy, R + 3, 0, Math.PI * 2); ctx.stroke(); }
        // close-up: initial + activity/mood tick
        if (lod > 1.25 && !dead) {
          ctx.fillStyle = '#fffdfa'; ctx.font = `700 ${Math.max(7, R)}px 'DM Sans'`; ctx.textAlign = 'center';
          ctx.fillText((c.name[0] ?? '·').toUpperCase(), sx, sy + R * 0.45);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#344c43'; ctx.font = `600 ${Math.max(9, 9 * z)}px 'DM Sans'`;
          ctx.fillText(`${c.name.split(' ')[0]} · ${activityGlyph(c.activity)} ${c.activity ?? ''}`, sx + 8, sy - 6);
        }
      }

      // night + season overlays
      if (dark > 0.02) { ctx.fillStyle = `rgba(40,48,76,${(dark * 0.42).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = seasonTint(pr.clock?.season ?? ''); ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toWorld = (px: number, py: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.width, H = canvas.height;
    const c = camRef.current;
    const z = c.z * (W / 1100);
    const sx = (px - rect.left) * dpr, sy = (py - rect.top) * dpr;
    return { x: c.x + (sx - W / 2) / z, y: c.y + (sy - H / 2) / z };
  };

  const pick = (wx: number, wy: number) => {
    const c = camRef.current;
    let bestC: CitizenSummary | null = null, bestCD = 22 / c.z;
    for (const ci of propsRef.current.citizens) {
      const sm = posRef.current.get(ci.id) ?? ci;
      const d = Math.hypot(sm.x - wx, sm.y - wy);
      if (d < bestCD) { bestCD = d; bestC = ci; }
    }
    if (bestC) return { kind: 'citizen' as const, c: bestC };
    let bestB: Building | null = null, bestBD = 34 / c.z;
    for (const b of propsRef.current.buildings) {
      const d = Math.hypot(b.x - wx, b.y - wy);
      if (d < bestBD) { bestBD = d; bestB = b; }
    }
    if (bestB) return { kind: 'building' as const, b: bestB };
    return null;
  };

  return (
    <div ref={wrapRef} className="mapbox">
      <canvas
        ref={canvasRef}
        style={{ cursor: 'grab' }}
        onWheel={(e) => {
          const nz = Math.min(4, Math.max(0.25, tgtRef.current.z * (e.deltaY < 0 ? 1.12 : 0.89)));
          tgtRef.current = { ...tgtRef.current, z: nz };
          setHud({ z: nz });
        }}
        onMouseDown={(e) => { dragRef.current = { sx: e.clientX, sy: e.clientY, cx: tgtRef.current.x, cy: tgtRef.current.y, moved: false }; }}
        onMouseMove={(e) => {
          const d = dragRef.current;
          if (d) {
            if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
            const z = camRef.current.z * ((canvasRef.current?.width ?? 1100) / 1100);
            tgtRef.current = { ...tgtRef.current, x: d.cx - (e.clientX - d.sx) / z, y: d.cy - (e.clientY - d.sy) / z };
            p.onHover(null);
            return;
          }
          const w = toWorld(e.clientX, e.clientY);
          const hit = pick(w.x, w.y);
          if (!hit) { p.onHover(null); return; }
          const rect = canvasRef.current!.getBoundingClientRect();
          if (hit.kind === 'citizen') p.onHover({ kind: 'citizen', title: hit.c.name, sub: `${hit.c.job} · $${Math.round(hit.c.wealth)} · mood ${Math.round(hit.c.mood ?? 50)}`, x: e.clientX - rect.left, y: e.clientY - rect.top });
          else p.onHover({ kind: 'building', title: hit.b.name, sub: `${hit.b.type}${hit.b.ownerId ? ' · owner ' + hit.b.ownerId.slice(0, 6) : ''}`, x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseUp={(e) => {
          const d = dragRef.current;
          dragRef.current = null;
          if (!d || d.moved) return;
          const w = toWorld(e.clientX, e.clientY);
          const hit = pick(w.x, w.y);
          if (!hit) { p.onSelectCitizen(null); p.onSelectBuilding(null); return; }
          if (hit.kind === 'citizen') { p.onSelectCitizen(hit.c.id); }
          else { p.onSelectBuilding(hit.b.id); }
        }}
        onMouseLeave={() => { dragRef.current = null; p.onHover(null); }}
        onDoubleClick={(e) => {
          const w = toWorld(e.clientX, e.clientY);
          tgtRef.current = { x: w.x, y: w.y, z: Math.min(4, tgtRef.current.z * 1.6) };
          setHud({ z: tgtRef.current.z });
        }}
      />
      <div className="map-hud br"><span className="hud-pill">{districtAt(cam.x, cam.y)} <span className="map-zoom-label">· {Math.round(hud.z * 100)}%</span></span></div>
    </div>
  );
}

function overlayTint(pr: Props, b: Building, _c: null): string | null {
  void _c;
  if (pr.overlay === 'wealth') {
    const w = b.funds ?? 5000;
    const a = Math.min(0.55, Math.max(0.05, w / 40000));
    return `rgba(69,153,120,${a.toFixed(2)})`;
  }
  return null;
}

function overlayCitizen(pr: Props, c: CitizenSummary): string {
  switch (pr.overlay) {
    case 'wealth': {
      const w = c.wealth ?? 0;
      if (w > 15000) return '#368d75';
      if (w > 6000) return '#79b499';
      if (w < 500) return '#d77662';
      return '#658e85';
    }
    case 'crime': return (c.health ?? 100) < 40 ? '#c86758' : (c.health ?? 100) < 70 ? '#ccac65' : '#658e85';
    case 'happiness': {
      const m = c.mood ?? 50;
      return m > 66 ? '#63a57a' : m < 33 ? '#d77662' : '#c89a51';
    }
    default: return '#408d84';
  }
}

function activityGlyph(a?: string): string {
  const s = (a || '').toLowerCase();
  if (s.includes('sleep') || s.includes('rest')) return '●';
  if (s.includes('work') || s.includes('shift')) return '▲';
  if (s.includes('eat') || s.includes('meal')) return '◆';
  if (s.includes('social') || s.includes('party') || s.includes('friend')) return '♥';
  if (s.includes('shop') || s.includes('market')) return '■';
  if (s.includes('jail') || s.includes('arrest')) return '✕';
  if (s.includes('sick') || s.includes('hospital')) return '+';
  return '·';
}
