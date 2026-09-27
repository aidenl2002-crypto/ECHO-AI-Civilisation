import type { CityLayout } from '@echo/shared';
import type { Building } from '../api';

export type Point = { x: number; y: number };
export type Camera = { x: number; y: number; zoom: number; turn: number };
export type CityBuilding = Building & { footprint?: { width: number; depth: number }; height?: number; rotation?: number; districtId?: string; variant?: string; address?: string };
export type Tree = Point & { size: number; hue: number };
export type Scene = { layout: CityLayout; buildings: CityBuilding[]; trees: Tree[]; signature: string };
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 78.233) * 43758.5453; return x - Math.floor(x); };
export const seed = (s: string) => [...s].reduce((v, c) => (v * 31 + c.charCodeAt(0)) | 0, 7);
export function rotate(x: number, y: number, turn: number): Point {
  switch ((turn % 4 + 4) % 4) { case 1: return { x: -y, y: x }; case 2: return { x: -x, y: -y }; case 3: return { x: y, y: -x }; default: return { x, y }; }
}
export function project(x: number, y: number, z: number, cam: Camera, width: number, height: number, scale: number): Point {
  const r = rotate(x - cam.x, y - cam.y, cam.turn);
  return { x: width / 2 + (r.x - r.y) * .7071 * scale, y: height * .53 + (r.x + r.y) * .425 * scale - z * .95 * scale };
}
export function groundDelta(dx: number, dy: number, cam: Camera, scale: number): Point {
  const a = dx / (.7071 * scale), b = dy / (.425 * scale);
  return rotate((a + b) / 2, (b - a) / 2, 4 - cam.turn);
}
export function inside(p: Point, polygon: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
export function corners(b: CityBuilding, padding = 0): Point[] {
  const w = (b.footprint?.width ?? 35) / 2 + padding, d = (b.footprint?.depth ?? 35) / 2 + padding;
  const a = b.rotation ?? 0, c = Math.cos(a), s = Math.sin(a);
  return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,y]) => ({ x: b.x + x*c - y*s, y: b.y + x*s + y*c }));
}
export function legacyLayout(buildings: CityBuilding[]): CityLayout {
  const width = Math.max(1000, ...buildings.map(b => b.x + 100)), height = Math.max(1000, ...buildings.map(b => b.y + 100));
  const roads: CityLayout['roads'] = [];
  for (let x=0;x<=width;x+=100) roads.push({id:`lx${x}`,name:'City street',kind:'local',width:12,points:[{x,y:0},{x,y:height}]});
  for (let y=0;y<=height;y+=100) roads.push({id:`ly${y}`,name:'City street',kind:'local',width:12,points:[{x:0,y},{x:width,y}]});
  return {version:2,width,height,boundary:[{x:-30,y:-30},{x:width+30,y:-30},{x:width+30,y:height+30},{x:-30,y:height+30}],water:[],roads,districts:[],greenSpaces:[]};
}
export function createScene(buildings: CityBuilding[], layout: CityLayout | null | undefined, signature: string): Scene {
  const l = layout ?? legacyLayout(buildings), trees: Tree[] = [];
  const lots = buildings.filter(b => b.type !== 'park').map(b => corners(b, 8));
  const clear = (p: Point) => !lots.some(q => inside(p,q)) && !l.water.some(q=>inside(p,q));
  for (const park of l.greenSpaces) {
    if (park.kind === 'plaza') continue;
    const xs=park.polygon.map(p=>p.x), ys=park.polygon.map(p=>p.y);
    const minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
    let n=seed(park.id);
    for(let x=minX;x<maxX;x+=park.kind==='woodland'?28:44) for(let y=minY;y<maxY;y+=park.kind==='woodland'?30:48) {
      const p={x:x+hash(n++)*28,y:y+hash(n++)*28};
      if(inside(p,park.polygon)&&clear(p)) trees.push({...p,size:12+hash(n++)*13,hue:hash(n++)});
    }
  }
  for(const road of l.roads) for(let i=1;i<road.points.length;i++) {
    const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    if(!len||road.kind==='pedestrian') continue;
    for(let t=32;t<len-25;t+=road.kind==='arterial'?55:78) for(const side of [-1,1]) {
      const p={x:a.x+dx*t/len+nx*(road.width/2+9)*side,y:a.y+dy*t/len+ny*(road.width/2+9)*side};
      if(clear(p)&&inside(p,l.boundary)) trees.push({...p,size:10+hash(t+i*31)*6,hue:hash(t+i*12)});
    }
  }
  // A ragged tree belt roots the city in its landscape; never add fictional buildings.
  for(let n=0;n<540;n++) {
    const p={x:hash(n*7+91)*l.width,y:hash(n*13+37)*l.height};
    if(!inside(p,l.boundary)&&clear(p)) trees.push({...p,size:14+hash(n+12)*15,hue:hash(n+63)});
  }
  return {layout:l,buildings,trees,signature};
}
