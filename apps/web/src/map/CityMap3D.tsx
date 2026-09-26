// Isometric city renderer. The simulation remains the source of truth; all extra
// architecture, trees and street detail here are deterministic decoration.
import React, { useEffect, useRef, useState } from 'react';
import type { Building, CitizenSummary, Clock, HeatItem } from '../api';

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

type Point = { x: number; y: number };
type Camera = { x: number; y: number; zoom: number; turn: number };
type Paint = { roof: string; left: string; right: string; accent: string; label: string };
type Pick = { kind: 'building' | 'citizen'; id: string; x: number; y: number; w: number; h: number };

const PAINT: Record<string, Paint> = {
  home: { roof: '#edac8d', left: '#d38972', right: '#ba6e60', accent: '#f7d8a9', label: '#8e4b3f' },
  town_hall: { roof: '#e8cf9a', left: '#c9a777', right: '#aa835f', accent: '#fff2cb', label: '#6e553f' },
  police: { roof: '#a9c8d8', left: '#779eaf', right: '#597f95', accent: '#dceef0', label: '#395e70' },
  clinic: { roof: '#b9d9ce', left: '#80b5a4', right: '#5d978d', accent: '#e9f8e8', label: '#41776e' },
  school: { roof: '#d5d0a1', left: '#b5af78', right: '#929158', accent: '#f6eab9', label: '#777248' },
  park: { roof: '#b5d39e', left: '#79a975', right: '#689364', accent: '#e5f2cd', label: '#4f7651' },
  factory: { roof: '#b9bfbc', left: '#909e9a', right: '#758782', accent: '#dfe6db', label: '#546b68' },
  warehouse: { roof: '#b9bfbc', left: '#909e9a', right: '#758782', accent: '#dfe6db', label: '#546b68' },
  grocery: { roof: '#f1cd8e', left: '#d3a964', right: '#b88b50', accent: '#fff0c8', label: '#906e37' },
  shop: { roof: '#f1cd8e', left: '#d3a964', right: '#b88b50', accent: '#fff0c8', label: '#906e37' },
  bar: { roof: '#d4a4a2', left: '#ad777d', right: '#905d68', accent: '#f0ccbd', label: '#744958' },
  restaurant: { roof: '#e2b599', left: '#bf8975', right: '#a36b60', accent: '#ffe2bd', label: '#8b574c' },
  bank: { roof: '#c9c5df', left: '#9c9bbf', right: '#797ca3', accent: '#ece8f6', label: '#626486' },
  farm: { roof: '#becd9c', left: '#90a772', right: '#738d5e', accent: '#e8edcc', label: '#566c4e' },
};
const DEFAULT_PAINT = PAINT.home;
const DISTRICTS = ['Old Town', 'Harbour', 'Northgate', 'Foundry', 'Palms', 'University', 'Market Row', 'Hillcrest', 'Docks'];
const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 78.233) * 43758.5453; return x - Math.floor(x); };
const seed = (s: string): number => [...s].reduce((v, c) => (v * 31 + c.charCodeAt(0)) | 0, 7);
const palette = (type: string): Paint => PAINT[type.toLowerCase()] ?? DEFAULT_PAINT;
const districtAt = (x: number, y: number): string => DISTRICTS[Math.min(2, Math.max(0, Math.floor(y / 340))) * 3 + Math.min(2, Math.max(0, Math.floor(x / 340)))] ?? 'Outskirts';
const heightFor = (b: Building): number => {
  if (b.type === 'park') return 0;
  if (b.type === 'factory' || b.type === 'warehouse') return 31;
  if (b.type === 'town_hall' || b.type === 'school' || b.type === 'bank') return 38;
  if (b.type === 'home') return 25 + Math.floor(hash(seed(b.id)) * 10);
  return 27 + Math.floor(hash(seed(b.id)) * 12);
};
const labelPriority = (b: Building): number => /town_hall|clinic|police|school|bank|grocery|restaurant|bar|factory|park/.test(b.type) ? 2 : 1;

function rotate(dx: number, dy: number, turn: number): Point {
  switch ((turn % 4 + 4) % 4) {
    case 1: return { x: -dy, y: dx };
    case 2: return { x: -dx, y: -dy };
    case 3: return { x: dy, y: -dx };
    default: return { x: dx, y: dy };
  }
}
function project(x: number, y: number, z: number, cam: Camera, width: number, height: number, scale: number): Point {
  const r = rotate(x - cam.x, y - cam.y, cam.turn);
  return { x: width / 2 + (r.x - r.y) * .7071 * scale, y: height / 2 + (r.x + r.y) * .425 * scale - z * .95 * scale };
}
function groundDelta(dx: number, dy: number, cam: Camera, scale: number): Point {
  const a = dx / (.7071 * scale), b = dy / (.425 * scale);
  const rx = (a + b) / 2, ry = (b - a) / 2;
  return rotate(rx, ry, 4 - cam.turn);
}
function poly(ctx: CanvasRenderingContext2D, points: Point[], fill: string, stroke?: string, lineWidth = 1): void {
  if (points.length === 0) return;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

function drawBox(ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number, scale: number,
  x: number, y: number, size: number, roofHeight: number, paint: Paint, dark: number, detail: boolean): { anchor: Point; bounds: Pick } {
  const half = size / 2;
  const corners = [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]];
  const base = corners.map(([a, b]) => project(a, b, 0, cam, width, height, scale));
  const top = corners.map(([a, b]) => project(a, b, roofHeight, cam, width, height, scale));
  const center = project(x, y, 0, cam, width, height, scale);
  ell(ctx, center.x + 8 * scale, center.y + 7 * scale, size * .76 * scale, size * .26 * scale, 'rgba(49,62,48,.17)');
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if ((base[i].y + base[j].y) / 2 <= center.y + .1) continue;
    poly(ctx, [top[i], top[j], base[j], base[i]], i % 2 ? paint.right : paint.left, 'rgba(53,66,59,.23)', Math.max(1, scale));
    if (!detail || size * scale < 16) continue;
    const levels = roofHeight > 32 ? [0.3, 0.57] : [0.43];
    for (const level of levels) for (let k = 1; k <= 2; k++) {
      const t = k / 3, edge = (u: number, h: number) => project(corners[i][0] + (corners[j][0] - corners[i][0]) * u,
        corners[i][1] + (corners[j][1] - corners[i][1]) * u, h, cam, width, height, scale);
      const a = edge(t - .075, roofHeight * level), b = edge(t + .075, roofHeight * level);
      const c = edge(t + .075, roofHeight * (level + .17)), d = edge(t - .075, roofHeight * (level + .17));
      poly(ctx, [a, b, c, d], dark > .32 ? '#ffdd91' : paint.accent, 'rgba(67,83,72,.23)', .5);
    }
  }
  poly(ctx, top, paint.roof, 'rgba(70,79,64,.4)', Math.max(1, 1.2 * scale));
  // Roof ridge, skylight and chimney make the mass read as a building rather than a tile.
  const ridgeA = project(x - half * .6, y, roofHeight + 5, cam, width, height, scale);
  const ridgeB = project(x + half * .6, y, roofHeight + 5, cam, width, height, scale);
  ctx.beginPath(); ctx.moveTo(ridgeA.x, ridgeA.y); ctx.lineTo(ridgeB.x, ridgeB.y);
  ctx.strokeStyle = 'rgba(255,252,231,.7)'; ctx.lineWidth = Math.max(1.2, 2 * scale); ctx.stroke();
  if (detail && size * scale > 20) {
    const skylight = project(x - half * .2, y - half * .22, roofHeight + .5, cam, width, height, scale);
    ell(ctx, skylight.x, skylight.y, Math.max(2, 3.3 * scale), Math.max(1.2, 1.8 * scale), 'rgba(255,252,227,.78)');
  }
  const xs = [...base, ...top].map((v) => v.x), ys = [...base, ...top].map((v) => v.y);
  return { anchor: project(x, y, roofHeight + 8, cam, width, height, scale),
    bounds: { kind: 'building', id: '', x: Math.min(...xs) - 7, y: Math.min(...ys) - 7, w: Math.max(...xs) - Math.min(...xs) + 14, h: Math.max(...ys) - Math.min(...ys) + 14 } };
}

export default function CityMap3D(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const cameraRef = useRef<Camera>({ x: 500, y: 500, zoom: .98, turn: 0 });
  const targetRef = useRef<Camera>({ x: 500, y: 500, zoom: .98, turn: 0 });
  const dragRef = useRef<{ x: number; y: number; camX: number; camY: number; moved: boolean } | null>(null);
  const pickRef = useRef<Pick[]>([]);
  const peopleRef = useRef(new Map<string, Point>());
  const [hud, setHud] = useState({ district: 'Palms', zoom: 98, turn: 0 });

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, tick = 0, width = 0, height = 0, dpr = 1;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(wrap);

    const draw = () => {
      const p = propsRef.current;
      tick++;
      const cam = cameraRef.current, target = targetRef.current;
      if (p.follow && p.selectedCitizenId) {
        const selected = p.citizens.find((v) => v.id === p.selectedCitizenId);
        if (selected) { target.x = selected.x; target.y = selected.y; }
      } else if (p.observer) {
        target.x = 500 + Math.sin(tick * .0015) * 180;
        target.y = 500 + Math.cos(tick * .0012) * 180;
      }
      if (p.cinematic) { target.x = 500 + Math.sin(tick * .003) * 105; target.y = 500 + Math.cos(tick * .002) * 105; }
      cam.x += (target.x - cam.x) * .09; cam.y += (target.y - cam.y) * .09; cam.zoom += (target.zoom - cam.zoom) * .12; cam.turn = target.turn;
      if (tick % 24 === 0) setHud({ district: districtAt(cam.x, cam.y), zoom: Math.round(cam.zoom * 100), turn: cam.turn });
      const scale = Math.max(width / 1250, height / 920) * cam.zoom;
      const at = (x: number, y: number, z = 0) => project(x, y, z, cam, width, height, scale);
      const hour = p.clock?.hour ?? 12;
      const night = hour < 6 || hour > 19 ? .62 : hour < 8 || hour > 17 ? .27 : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#c7dcc2'); bg.addColorStop(1, '#a8c6ae');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);

      // Ground plane, streets and distinct lots. Streets follow the same world
      // coordinates as the simulation, so residents always occupy real places.
      const ground = [at(-30, -30), at(1030, -30), at(1030, 1030), at(-30, 1030)];
      poly(ctx, ground, '#aeb9a7');
      for (let gy = 0; gy < 10; gy++) for (let gx = 0; gx < 10; gx++) {
        const x = gx * 100, y = gy * 100;
        const park = (gx * 7 + gy * 13) % 11 === 0;
        const lot = [at(x + 7, y + 7), at(x + 93, y + 7), at(x + 93, y + 93), at(x + 7, y + 93)];
        poly(ctx, lot, park ? '#a6ce93' : (gx + gy) % 3 === 0 ? '#e8dfc9' : '#e5e1cf', park ? '#8aae81' : '#d2d0bd', .8);
        if (park) {
          const path = [at(x + 15, y + 58), at(x + 43, y + 48), at(x + 77, y + 45), at(x + 91, y + 26)];
          ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
          ctx.strokeStyle = '#f4e9ca'; ctx.lineWidth = Math.max(2, 5 * scale); ctx.stroke();
        }
      }
      // Street centre dashes are subtle at overview and clarify orientation.
      if (scale > .3) for (let road = 0; road <= 1000; road += 100) for (let step = 25; step < 1000; step += 55) {
        const a = at(road, step), b = at(road, step + 22);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(251,247,223,.66)'; ctx.lineWidth = Math.max(1, 1.4 * scale); ctx.stroke();
      }
      if (p.routeTo && p.selectedCitizenId) {
        const citizen = p.citizens.find((v) => v.id === p.selectedCitizenId);
        if (citizen) {
          const a = at(citizen.x, citizen.y, 2), b = at(p.routeTo.x, p.routeTo.y, 2);
          ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = '#238c81'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
        }
      }

      type Item = { x: number; y: number; size: number; height: number; paint: Paint; building?: Building };
      const items: Item[] = [];
      for (let gy = 0; gy < 10; gy++) for (let gx = 0; gx < 10; gx++) {
        const x = gx * 100 + 50, y = gy * 100 + 50;
        const park = (gx * 7 + gy * 13) % 11 === 0;
        if (park) continue;
        const close = p.buildings.some((b) => Math.abs(b.x - x) < 53 && Math.abs(b.y - y) < 53);
        if (close) continue;
        const n = hash(gx * 31 + gy * 79);
        if (n < .14) continue;
        const decorPaint = n > .72 ? PAINT.shop : n > .49 ? PAINT.home : PAINT.factory;
        items.push({ x: x - 11, y: y + 5, size: 22 + n * 9, height: 12 + n * 15, paint: decorPaint });
        if (n > .42) items.push({ x: x + 22, y: y - 19, size: 17 + n * 5, height: 11 + n * 10, paint: PAINT.home });
      }
      for (const b of p.buildings) if (b.type !== 'park') items.push({
        x: b.x, y: b.y, size: b.type === 'factory' ? 49 : b.type === 'town_hall' ? 46 : b.type === 'home' ? 32 : 39,
        height: heightFor(b), paint: palette(b.type), building: b,
      });
      items.sort((a, b) => at(a.x, a.y).y - at(b.x, b.y).y);
      const picks: Pick[] = [];
      const labels: Array<{ b: Building; anchor: Point; paint: Paint }> = [];
      for (const item of items) {
        let visualPaint = item.building ? item.paint : { ...item.paint, roof: '#d5cfbd', left: '#beb7a8', right: '#aaa99a' };
        if (item.building && p.overlay === 'wealth' && item.building.funds != null) {
          const rich = item.building.funds > 10000;
          visualPaint = { ...item.paint, roof: rich ? '#67ba88' : '#e3ab78', left: rich ? '#448f75' : '#b47562', right: rich ? '#397b6a' : '#976456' };
        }
        const d = drawBox(ctx, cam, width, height, scale, item.x, item.y, item.size, item.height, visualPaint, night, !!item.building);
        if (item.building) {
          const b = item.building;
          d.bounds.id = b.id; picks.push(d.bounds);
          labels.push({ b, anchor: d.anchor, paint: item.paint });
          if (p.selectedBuildingId === b.id || p.pinned.includes(b.id)) {
            ell(ctx, at(b.x, b.y).x, at(b.x, b.y).y, 31 * scale, 15 * scale, 'rgba(244,146,83,.28)');
          }
        }
      }
      // Groves and pavement trees sit above low architecture.
      for (let gy = 0; gy < 10; gy++) for (let gx = 0; gx < 10; gx++) {
        const park = (gx * 7 + gy * 13) % 11 === 0;
        if (!park && hash(gx * 43 + gy * 17) < .4) continue;
        const count = park ? 5 : 2;
        for (let k = 0; k < count; k++) {
          const wx = gx * 100 + 16 + hash(gx * 91 + gy * 51 + k * 11) * 68;
          const wy = gy * 100 + 17 + hash(gx * 23 + gy * 87 + k * 19) * 66;
          const base = at(wx, wy), crown = at(wx, wy, 14 + k % 3 * 4);
          ell(ctx, base.x + 4 * scale, base.y + 3 * scale, 8 * scale, 3 * scale, 'rgba(45,82,51,.2)');
          ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(crown.x, crown.y);
          ctx.strokeStyle = '#776c50'; ctx.lineWidth = Math.max(1, 2.7 * scale); ctx.stroke();
          ell(ctx, crown.x, crown.y, Math.max(3, 8 * scale), Math.max(2, 5 * scale), k % 2 ? '#589a69' : '#75ac70');
          ell(ctx, crown.x - 2 * scale, crown.y - 2 * scale, Math.max(2, 5 * scale), Math.max(1, 3 * scale), '#9dc789');
        }
      }
      // Park names also refer to real, inspectable buildings.
      for (const b of p.buildings) if (b.type === 'park') {
        labels.push({ b, anchor: at(b.x, b.y, 12), paint: PAINT.park });
        const pt = at(b.x, b.y); picks.push({ kind: 'building', id: b.id, x: pt.x - 30, y: pt.y - 22, w: 60, h: 44 });
      }
      if (night > 0) { ctx.fillStyle = 'rgba(29,40,70,' + (night * .46).toFixed(2) + ')'; ctx.fillRect(0, 0, width, height); }
      // Residents are raised above the street, with a floor shadow and clear
      // silhouette, and their positions interpolate between simulation polls.
      const heatById = new Map(p.heat.map((v) => [v.id, v]));
      for (const person of p.citizens) {
        let current = peopleRef.current.get(person.id);
        if (!current) { current = { x: person.x, y: person.y }; peopleRef.current.set(person.id, current); }
        current.x += (person.x - current.x) * .16; current.y += (person.y - current.y) * .16;
        const floor = at(current.x, current.y), head = at(current.x, current.y, 11);
        if (head.x < -30 || head.y < -30 || head.x > width + 30 || head.y > height + 30) continue;
        const selected = person.id === p.selectedCitizenId;
        const heat = heatById.get(person.id);
        const personColor = p.overlay === 'wealth'
          ? person.wealth > 2500 ? '#43a677' : person.wealth < 500 ? '#d77964' : '#d2ab61'
          : p.overlay === 'happiness'
            ? (person.mood ?? 50) > 67 ? '#43a677' : (person.mood ?? 50) < 38 ? '#d77964' : '#d2ab61'
            : p.overlay === 'ai' && heat
              ? heat.attention > .5 ? '#a17cba' : '#6e91a5'
              : '#258d88';
        ell(ctx, floor.x, floor.y, 7 * scale, 3.2 * scale, 'rgba(36,73,64,.25)');
        ctx.beginPath(); ctx.moveTo(floor.x, floor.y - 2); ctx.lineTo(head.x, head.y + 3);
        ctx.strokeStyle = selected ? '#e1714d' : personColor; ctx.lineWidth = Math.max(2, 5 * scale); ctx.lineCap = 'round'; ctx.stroke();
        ell(ctx, head.x, head.y, selected ? 7 : 5.2, selected ? 7 : 5.2, person.alive === false ? '#978b84' : selected ? '#e1714d' : personColor);
        ell(ctx, head.x - 1.4, head.y - 2, selected ? 3 : 2.4, selected ? 2 : 1.5, '#c2eae0');
        if (heat && (heat.attention > .5 || p.overlay === 'ai')) {
          ctx.beginPath(); ctx.arc(head.x, head.y, 8 + Math.sin(tick * .1) * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#a17cba'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        if (selected || p.pinned.includes(person.id)) {
          ctx.beginPath(); ctx.arc(head.x, head.y, 10, 0, Math.PI * 2);
          ctx.strokeStyle = selected ? '#f9b47c' : '#d0a45f'; ctx.lineWidth = 2; ctx.stroke();
        }
        picks.push({ kind: 'citizen', id: person.id, x: head.x - 10, y: head.y - 12, w: 20, h: 24 });
      }
      // Every real building is named at normal zoom. Collision resolution shifts
      // labels upward into compact tiers and draws a leader to the roof.
      labels.sort((a, b) => Number(b.b.id === p.selectedBuildingId) - Number(a.b.id === p.selectedBuildingId) || labelPriority(b.b) - labelPriority(a.b));
      const occupied: Array<{ x: number; y: number; w: number; h: number }> = [
        { x: 8, y: 8, w: Math.min(305, width * .45), h: 142 },
        { x: Math.max(0, width - 330), y: 108, w: 330, h: 104 },
        { x: 0, y: height - 70, w: 360, h: 70 },
        { x: Math.max(0, width - 235), y: height - 70, w: 235, h: 70 },
      ];
      ctx.font = '700 12px system-ui, sans-serif'; ctx.textBaseline = 'middle';
      for (const item of labels) {
        const { b, anchor, paint } = item;
        if (anchor.x < -140 || anchor.x > width + 140 || anchor.y < -90 || anchor.y > height + 40) continue;
        const selected = b.id === p.selectedBuildingId, important = labelPriority(b) > 1;
        if (cam.zoom < .62 && !selected && !important) continue;
        const title = b.name.length > 22 ? b.name.slice(0, 20) + '…' : b.name;
        const textWidth = ctx.measureText(title).width, pillW = textWidth + 24, pillH = 24;
        const choices = [
          { x: anchor.x - pillW / 2, y: anchor.y - 31 },
          { x: anchor.x - pillW / 2, y: anchor.y + 11 },
          { x: anchor.x - pillW - 15, y: anchor.y - 12 },
          { x: anchor.x + 15, y: anchor.y - 12 },
          { x: anchor.x - pillW / 2, y: anchor.y - 58 },
          { x: anchor.x - pillW / 2, y: anchor.y + 37 },
          { x: anchor.x - pillW - 15, y: anchor.y - 39 },
          { x: anchor.x + 15, y: anchor.y - 39 },
        ];
        const place = choices.map((v) => ({ x: Math.max(5, Math.min(width - pillW - 5, v.x)), y: v.y }))
          .find((v) => v.y >= 4 && v.y <= height - pillH - 4 &&
            !occupied.some((r) => v.x < r.x + r.w + 3 && v.x + pillW + 3 > r.x && v.y < r.y + r.h + 3 && v.y + pillH + 3 > r.y));
        if (!place) continue;
        const px = place.x, py = place.y;
        occupied.push({ x: px, y: py, w: pillW, h: pillH });
        ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y - 1);
        ctx.lineTo(Math.max(px + 8, Math.min(px + pillW - 8, anchor.x)), Math.max(py + 4, Math.min(py + pillH - 4, anchor.y)));
        ctx.strokeStyle = 'rgba(48,68,59,.45)'; ctx.lineWidth = 1; ctx.stroke();
        rounded(ctx, px, py, pillW, pillH, 8, selected ? '#2d766e' : 'rgba(255,253,244,.94)', selected ? '#1d6b60' : 'rgba(77,100,75,.24)');
        ctx.fillStyle = selected ? '#fffdf4' : paint.label; ctx.fillText(title, px + 12, py + pillH / 2 + .5);
        picks.push({ kind: 'building', id: b.id, x: px, y: py, w: pillW, h: pillH });
      }
      pickRef.current = picks;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);

  const hitAt = (clientX: number, clientY: number): Pick | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left, y = clientY - rect.top;
    for (let i = pickRef.current.length - 1; i >= 0; i--) {
      const h = pickRef.current[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  };
  const pan = (dx: number, dy: number, baseX: number, baseY: number) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const scale = Math.max(wrap.clientWidth / 1250, wrap.clientHeight / 920) * cameraRef.current.zoom;
    const delta = groundDelta(dx, dy, cameraRef.current, scale);
    targetRef.current.x = Math.max(-120, Math.min(1120, baseX - delta.x));
    targetRef.current.y = Math.max(-120, Math.min(1120, baseY - delta.y));
  };
  const zoom = (factor: number) => { targetRef.current.zoom = Math.max(.38, Math.min(3.2, targetRef.current.zoom * factor)); };

  return (
    <div className="mapbox mapbox-3d" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="Interactive isometric map of Echo City" role="img"
        onWheel={(e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : .89); }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY, camX: targetRef.current.x, camY: targetRef.current.y, moved: false }; }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (drag) {
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
            if (drag.moved) { pan(dx, dy, drag.camX, drag.camY); propsRef.current.onHover(null); }
            return;
          }
          const hit = hitAt(e.clientX, e.clientY);
          if (!hit) { propsRef.current.onHover(null); return; }
          const rect = canvasRef.current!.getBoundingClientRect();
          const b = hit.kind === 'building' ? propsRef.current.buildings.find((v) => v.id === hit.id) : null;
          const c = hit.kind === 'citizen' ? propsRef.current.citizens.find((v) => v.id === hit.id) : null;
          propsRef.current.onHover({ kind: hit.kind, title: b?.name ?? c?.name ?? '',
            sub: b ? b.type.replace(/_/g, ' ') : c ? c.job + ' · $' + Math.round(c.wealth).toLocaleString() : '',
            x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current; dragRef.current = null;
          if (!drag || drag.moved) return;
          const hit = hitAt(e.clientX, e.clientY);
          if (hit?.kind === 'citizen') propsRef.current.onSelectCitizen(hit.id);
          else if (hit?.kind === 'building') propsRef.current.onSelectBuilding(hit.id);
          else { propsRef.current.onSelectCitizen(null); propsRef.current.onSelectBuilding(null); }
        }}
        onPointerCancel={() => { dragRef.current = null; propsRef.current.onHover(null); }}
        onPointerLeave={() => { if (!dragRef.current) propsRef.current.onHover(null); }}
        onDoubleClick={(e) => {
          const hit = hitAt(e.clientX, e.clientY);
          if (hit) {
            const v = hit.kind === 'building' ? propsRef.current.buildings.find((b) => b.id === hit.id) : propsRef.current.citizens.find((c) => c.id === hit.id);
            if (v) { targetRef.current.x = v.x; targetRef.current.y = v.y; }
          }
          zoom(1.45);
        }}
      />
      <div className="map-3d-controls" aria-label="Map camera controls">
        <button title="Rotate city left" aria-label="Rotate city left" onClick={() => { targetRef.current.turn = (targetRef.current.turn + 3) % 4; }}>↶</button>
        <span>{hud.district} · {hud.zoom}%</span>
        <button title="Rotate city right" aria-label="Rotate city right" onClick={() => { targetRef.current.turn = (targetRef.current.turn + 1) % 4; }}>↷</button>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => zoom(.82)}>−</button>
        <button title="Zoom in" aria-label="Zoom in" onClick={() => zoom(1.2)}>+</button>
        <button title="Reset camera" aria-label="Reset camera" onClick={() => { targetRef.current = { x: 500, y: 500, zoom: .98, turn: 0 }; }}>⌂</button>
      </div>
    </div>
  );
}
