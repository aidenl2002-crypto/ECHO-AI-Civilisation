import type { CityLayout, Vec2 } from '@echo/shared';
import type { WorldState } from '../world.js';
export const WORLD_SIZE = 1000; // legacy worlds
export const SPEED_PER_TICK = 9;
export const CITY_SPEED_PER_TICK = 85; // five simulated minutes, ~1 km walk per hour
export function dist(a: Vec2,b: Vec2):number{return Math.hypot(a.x-b.x,a.y-b.y);}
type Segment={a:number;b:number};
type Graph={points:Vec2[];links:Array<Array<{to:number;cost:number}>>;segments:Segment[]};
// Save loading replaces the layout object, naturally invalidating its cached graph.
const graphs=new WeakMap<CityLayout,Graph>();
function graphFor(layout:CityLayout):Graph{
  const existing=graphs.get(layout);if(existing)return existing;
  const graph:Graph={points:[],links:[],segments:[]};const keys=new Map<string,number>();
  const node=(p:Vec2)=>{const key=`${p.x.toFixed(3)},${p.y.toFixed(3)}`;const found=keys.get(key);if(found!==undefined)return found;const id=graph.points.length;keys.set(key,id);graph.points.push(p);graph.links.push([]);return id;};
  for(const road of layout.roads)for(let i=1;i<road.points.length;i++){const a=node(road.points[i-1]),b=node(road.points[i]);const cost=dist(graph.points[a],graph.points[b]);graph.links[a].push({to:b,cost});graph.links[b].push({to:a,cost});graph.segments.push({a,b});}
  graphs.set(layout,graph);return graph;
}
function project(p:Vec2,a:Vec2,b:Vec2):Vec2{const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return{x:a.x+t*dx,y:a.y+t*dy};}
function closest(graph:Graph,p:Vec2){let best={segment:graph.segments[0],point:p,distance:Infinity};for(const segment of graph.segments){const point=project(p,graph.points[segment.a],graph.points[segment.b]);const distance=dist(p,point);if(distance<best.distance)best={segment,point,distance};}return best;}
/** Shortest walk through shared road nodes, including exact projected entry/exit points. */
export function planRoute(state:WorldState,from:Vec2,to:Vec2):Vec2[]{
  if(!state.layout?.roads.length)return[{...to}];const graph=graphFor(state.layout);if(!graph.segments.length)return[{...to}];
  const start=closest(graph,from),end=closest(graph,to);
  if(start.segment===end.segment)return[start.point,end.point,{...to}];
  const costs=graph.points.map(()=>Infinity),previous=graph.points.map(()=>-1),visited=new Set<number>();
  for(const n of [start.segment.a,start.segment.b])costs[n]=dist(start.point,graph.points[n]);
  for(let count=0;count<graph.points.length;count++){
    let u=-1;for(let i=0;i<costs.length;i++)if(!visited.has(i)&&(u===-1||costs[i]<costs[u]))u=i;
    if(u===-1||!Number.isFinite(costs[u]))break;visited.add(u);
    for(const edge of graph.links[u])if(costs[u]+edge.cost<costs[edge.to]){costs[edge.to]=costs[u]+edge.cost;previous[edge.to]=u;}
  }
  const goal=[end.segment.a,end.segment.b].sort((a,b)=>costs[a]+dist(graph.points[a],end.point)-costs[b]-dist(graph.points[b],end.point))[0];
  if(!Number.isFinite(costs[goal]))return[]; // an unreachable destination does not send people across water
  const points:Vec2[]=[];let current=goal;while(current!==-1){points.push(graph.points[current]);current=previous[current];}
  return[start.point,...points.reverse(),end.point,{...to}];
}
type Trip={destination:string;points:Vec2[];index:number;last:Vec2};
const trips=new WeakMap<WorldState,Map<string,Trip>>();
export function moveTowards(state:WorldState,citizenId:string):boolean{
  const c=state.citizens[citizenId];if(!c||!c.alive||!c.destinationBuildingId)return true;
  const b=state.buildings[c.destinationBuildingId];if(!b){c.destinationBuildingId=null;return true;}
  let cache=trips.get(state);if(!cache){cache=new Map();trips.set(state,cache);}let trip=cache.get(c.id);
  if(!trip||trip.destination!==b.id||dist(trip.last,c.position)>0.01){
    const points=planRoute(state,c.position,b.entrance??b.position);
    if(!points.length){c.destinationBuildingId=null;cache.delete(c.id);return false;}
    points.push({...b.position});
    trip={destination:b.id,points,index:0,last:{...c.position}};cache.set(c.id,trip);
  }
  let budget=state.layout?CITY_SPEED_PER_TICK:SPEED_PER_TICK;
  while(trip.index<trip.points.length){const target=trip.points[trip.index],d=dist(c.position,target);if(d<=budget){c.position={...target};budget-=d;trip.index++;}else{c.position={x:c.position.x+(target.x-c.position.x)/d*budget,y:c.position.y+(target.y-c.position.y)/d*budget};break;}}
  trip.last={...c.position};
  if(trip.index>=trip.points.length){c.position={...b.position};c.destinationBuildingId=null;cache.delete(c.id);return true;}return false;
}

/** Remaining street waypoints for optional map travel overlays. */
export function getCitizenRoute(state:WorldState,citizenId:string):Vec2[]{const trip=trips.get(state)?.get(citizenId);return trip?trip.points.slice(trip.index).map(p=>({...p})):[];}
