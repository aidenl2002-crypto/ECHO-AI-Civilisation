import type { Building, BuildingType, CityDistrict, CityLayout, Vec2 } from '@echo/shared';
import { Rng } from './rng.js';
const polygon = (x: number, y: number, w: number, h: number): Vec2[] => [{x,y},{x:x+w,y:y+20},{x:x+w-25,y:y+h},{x:x+15,y:y+h-15}];

/** A connected street skeleton shaped by the river, with parcels laid out along streets. */
export function generateCity(seed: number): { layout: CityLayout; buildings: Record<string, Building> } {
  // Keep parcel variation reproducible without consuming the simulation's random stream.
  const rng = new Rng(seed ^ 0x41c17);
  const specs: Array<[string,string,CityDistrict['kind'],number,number,number,number,string,number]> = [
    ['oldtown','Old Town','old_town',300,210,880,670,'#d6b58d',0.78],
    ['downtown','Financial Quarter','downtown',1230,170,1130,650,'#a7bec5',0.95],
    ['civic','Civic Gardens','civic',900,880,700,640,'#b4c6a0',0.87],
    ['entertainment','Lantern Quarter','entertainment',1610,890,770,580,'#d4adba',0.82],
    ['suburbs','Willow Heights','suburb',220,1110,690,1220,'#c1cba0',0.72],
    ['industry','Foundry & Docks','industrial',1180,1660,1230,690,'#b4aaa0',0.38],
    ['riverside','Riverwalk','riverside',2200,520,300,1180,'#9fc6bd',0.9],
  ];
  const districts = specs.map(([id,name,kind,x,y,w,h,color,desirability]) => ({id,name,kind,center:{x:x+w/2,y:y+h/2},polygon:polygon(x,y,w,h),color,desirability,rentMultiplier:0.7+desirability}));
  const layout: CityLayout = {version:2,width:3200,height:2600,
    boundary:[{x:270,y:240},{x:990,y:110},{x:1870,y:130},{x:2400,y:340},{x:2530,y:820},{x:2400,y:1360},{x:2640,y:1920},{x:2490,y:2360},{x:1510,y:2490},{x:640,y:2390},{x:170,y:1870},{x:250,y:1180},{x:120,y:750}],
    water:[[{x:2710,y:0},{x:2670,y:450},{x:2540,y:950},{x:2610,y:1330},{x:2790,y:1860},{x:2820,y:2600},{x:3040,y:2600},{x:3010,y:1840},{x:2820,y:1320},{x:2750,y:970},{x:2880,y:480},{x:2950,y:0}]],
    districts,roads:[],greenSpaces:[{id:'g_civic',name:'Founders Gardens',kind:'park',polygon:polygon(1040,1050,330,260)},{id:'g_willow',name:'Willow Common',kind:'park',polygon:polygon(470,1600,340,225)},{id:'g_north',name:'Northwood',kind:'woodland',polygon:polygon(580,10,570,190)},{id:'g_river',name:'Riverside Meadows',kind:'park',polygon:polygon(2370,1490,145,240)}]};

  // An authored skeleton gives each district a distinct history and grain.
  // Every branch starts at an existing node; shared junctions form the walking graph.
  type XY=[number,number];
  const road=(id:string,name:string,kind:CityLayout['roads'][number]['kind'],width:number,points:XY[])=>layout.roads.push({id,name,kind,width,points:points.map(([x,y])=>({x,y}))});
  road('unity','Unity Boulevard','arterial',34,[[1250,280],[1280,750],[1280,1140],[1400,1570],[1460,2170]]);
  road('grand','Grand Avenue','arterial',30,[[330,1100],[800,1080],[1280,1140],[1810,1130],[2320,1190]]);
  road('exchange','Exchange Avenue','main',24,[[1280,750],[1740,720],[2200,750]]);
  road('financial','Financial Crescent','main',24,[[1740,720],[1740,280],[2200,330],[2200,750]]);
  road('northgate','Northgate','main',24,[[1250,280],[1740,280]]);
  road('meridian','Meridian Street','main',24,[[1740,720],[1810,1130]]);
  road('king','King Street','local',15,[[1280,750],[1040,640],[730,710],[470,660]]);
  road('cathedral','Cathedral Lane','local',13,[[1250,280],[1000,320],[720,400],[420,350]]);
  road('bell','Bell Court','local',11,[[730,710],[790,520],[720,400]]);
  road('westgate','Westgate','local',14,[[470,660],[400,520],[420,350]]);
  road('market','Market Lane','pedestrian',10,[[730,710],[600,880],[420,900]]);
  road('library','Library Road','main',20,[[800,1080],[840,800],[1040,640]]);
  road('willow','Willow Crescent','main',19,[[330,1100],[360,1410],[300,1690],[450,2050],[750,2240],[1100,2150],[1460,2170]]);
  road('elm','Elm Close','local',12,[[360,1410],[640,1320],[840,1400],[900,1580]]);
  road('birch','Birch Court','local',12,[[300,1690],[440,1810],[670,1860]]);
  road('garden','Garden Close','local',12,[[450,2050],[600,2030],[750,2080],[800,1990]]);
  road('orchard','Orchard Rise','local',12,[[1100,2150],[1090,1900],[900,1770]]);
  road('foundry','Foundry Way','arterial',30,[[1400,1570],[1900,1660],[2390,1860]]);
  road('dockside','Dockside Drive','main',27,[[1460,2170],[1980,2200],[2390,2130],[2390,1860]]);
  road('freight','Freight Road','main',27,[[1900,1660],[1980,2200]]);
  road('lantern','Lantern Street','local',17,[[1810,1130],[1980,1320],[2330,1440]]);
  road('marina','Marina Road','main',22,[[2200,750],[2350,920],[2320,1190],[2330,1440],[2200,1590],[1900,1660]]);
  road('theatre','Theatre Walk','pedestrian',12,[[1980,1320],[1840,1470],[1690,1500]]);
  road('quayside','Quayside','pedestrian',12,[[2350,920],[2440,1000],[2460,1270],[2440,1460],[2490,1690]]);
  road('bridge','Unity Bridge','arterial',32,[[2320,1190],[2460,1270],[2650,1250],[2840,1260],[3130,1320]]);
  const buildings: Record<string,Building>={};
  const within=(p:Vec2,poly:Vec2[])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
  const districtAt=(p:Vec2)=>{const containing=districts.filter(d=>within(p,d.polygon));return(containing.length?containing:districts).reduce((a,b)=>Math.hypot(p.x-a.center.x,p.y-a.center.y)<Math.hypot(p.x-b.center.x,p.y-b.center.y)?a:b);};
  const distanceToSegment=(p:Vec2,a:Vec2,b:Vec2)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
  let count=0;
  for(const street of layout.roads){
    if(street.id==='bridge')continue;
    for(let segment=1;segment<street.points.length;segment++){
      const a=street.points[segment-1],b=street.points[segment],angle=Math.atan2(b.y-a.y,b.x-a.x),length=Math.hypot(b.x-a.x,b.y-a.y);
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},kind=districtAt(mid).kind;
      const spacing=kind==='industrial'?154:kind==='suburb'?120:kind==='old_town'?94:105;
      const slots=Math.max(1,Math.floor((length-55)/spacing));
      for(let slot=0;slot<slots;slot++)for(const side of [-1,1]){
        // Courtyards, setbacks and variable frontage leave visible breathing room.
        if(street.id==='quayside'&&side===1)continue;
        const t=(slot+1)/(slots+1),entrance={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
        const setback=street.width/2+(kind==='suburb'?rng.range(49,64):kind==='industrial'?rng.range(55,65):rng.range(39,49));
        const position={x:entrance.x-Math.sin(angle)*side*setback,y:entrance.y+Math.cos(angle)*side*setback};
        if(!within(position,layout.boundary)||layout.water.some(w=>within(position,w))||layout.greenSpaces.some(g=>within(position,g.polygon)))continue;
        const district=districtAt(position);
        const width=district.kind==='industrial'?rng.int(86,106):district.kind==='old_town'?rng.int(40,54):rng.int(46,66);
        const depth=district.kind==='industrial'?rng.int(62,80):district.kind==='suburb'?rng.int(38,48):rng.int(40,58);
        const radius=Math.hypot(width,depth)/2;
        if(Object.values(buildings).some(b=>Math.hypot(b.position.x-position.x,b.position.y-position.y)<radius+Math.hypot(b.footprint!.width,b.footprint!.depth)/2+7))continue;
        // Reject parcels that would obstruct another branch at an acute junction.
        if(layout.roads.some(other=>other.points.slice(1).some((p,i)=>other!==street&&distanceToSegment(position,other.points[i],p)<radius+other.width/2+4)))continue;
        const roll=rng.next();let type:BuildingType='home',variant='townhouse';
        switch(district.kind){
          case 'downtown':type=roll<0.35?'home':roll<0.62?'bank':roll<0.82?'shop':'restaurant';variant=type==='home'?'apartment_tower':type==='bank'?'office_tower':'department_store';break;
          case 'industrial':type=roll<0.5?'factory':roll<0.8?'warehouse':roll<0.9?'home':'shop';variant=type==='home'?'workers_terrace':type;break;
          case 'entertainment':type=roll<0.3?'bar':roll<0.58?'restaurant':roll<0.8?'shop':'home';variant=type==='bar'?'nightclub':type==='restaurant'?'cafe':type==='home'?'hotel':'boutique';break;
          case 'suburb':type=roll<0.78?'home':roll<0.86?'school':roll<0.94?'grocery':'clinic';variant=type==='home'?'detached_house':type;break;
          case 'old_town':type=roll<0.52?'home':roll<0.67?'bar':roll<0.83?'shop':'restaurant';variant=type==='bar'?'pub':type==='home'?'terrace':'heritage_shop';break;
          case 'civic':type=roll<0.42?'home':roll<0.6?'school':roll<0.75?'clinic':roll<0.86?'bank':'restaurant';variant=type==='home'?'garden_apartment':type==='school'?'university':type;break;
          case 'riverside':type=roll<0.5?'home':roll<0.76?'restaurant':'shop';variant=type==='home'?'waterfront_apartment':'waterfront_cafe';break;
        }
        const tall=district.kind==='downtown',industrial=type==='warehouse'||type==='factory';
        const height=tall?rng.int(60,170):type==='home'&&district.kind==='suburb'?rng.int(19,30):industrial?rng.int(26,44):rng.int(28,62);
        const id='b_city_'+count++,address=(slot*2+(side===1?2:1)+segment*10)+' '+street.name;
        const name=type==='home'?address:rng.pick(['Copper','Willow','Crown','Meridian','Harbour','Atlas','Juniper','Silver'])+' '+variant.replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase())+' '+count;
        buildings[id]={id,name,type,position,capacity:type==='home'?(tall?100:variant==='detached_house'?6:variant==='garden_apartment'||variant==='waterfront_apartment'?32:12):industrial?28:20,ownerId:null,workers:[],inventory:type==='grocery'||type==='restaurant'||type==='bar'||type==='shop'?{meal:120,goods:80}:industrial?{goods:150}:{},openingHours:{open:type==='bar'?16:6,close:type==='bar'?24:22},economic:{funds:type==='home'?0:7500,priceLevel:1,wagesOwed:0},districtId:district.id,address,variant,footprint:{width,depth},height,rotation:angle,entrance,propertyValue:Math.round((height*1400+60000)*district.rentMultiplier),rent:Math.round(100*district.rentMultiplier),condition:rng.int(68,100),desirability:district.desirability};
      }
    }
  }

  const fixed: Array<[string,string,BuildingType,string]>=[['b_townhall','Echo City Hall','town_hall','civic'],['b_police','Central Police','police','civic'],['b_clinic','St. Anne Hospital','clinic','civic'],['b_bar','The Copper Lantern','bar','entertainment'],['b_rest','Grand Restaurant','restaurant','downtown'],['b_groc','Market Hall','grocery','oldtown'],['b_fact','Echo Steelworks','factory','industry'],['b_bank','City Exchange','bank','downtown'],['b_school','Willow School','school','suburbs'],['b_park','Founders Gardens','park','civic'],['b_shop1','Old Town Stores','shop','oldtown'],['b_shop2','Riverside Market','shop','riverside']];
  for(const [id,name,type,districtId] of fixed){const candidates=Object.values(buildings).filter(b=>b.id.startsWith('b_city_')&&b.districtId===districtId);const district=districts.find(d=>d.id===districtId)!;const fallback=Object.values(buildings).filter(b=>b.id.startsWith('b_city_')).sort((a,b)=>Math.hypot(a.position.x-district.center.x,a.position.y-district.center.y)-Math.hypot(b.position.x-district.center.x,b.position.y-district.center.y));const old=candidates.find(b=>b.type===type)??candidates[0]??fallback[0];if(!old)continue;delete buildings[old.id];buildings[id]={...old,id,name,type,districtId,variant:type==='town_hall'?'city_hall':type==='park'?'garden':type==='police'?'police_station':type==='clinic'?'hospital':old.variant,capacity:type==='park'?200:old.capacity,inventory:type==='grocery'||type==='restaurant'||type==='bar'||type==='shop'?{meal:180,goods:120}:type==='clinic'?{medicine:80}:type==='factory'?{goods:150}:{},economic:{funds:type==='park'?0:7500,priceLevel:1,wagesOwed:0}};}
  // Keep the original public home identifiers for scripts and saved integrations.
  Object.values(buildings).filter(b=>b.type==='home').slice(0,8).forEach((home,i)=>{delete buildings[home.id];home.id='b_home'+i;buildings[home.id]=home;});
  const park=buildings.b_park;
  park.position={x:1200,y:1190};park.entrance={x:1200,y:1120};park.footprint={width:240,depth:170};park.height=2;
  const hall=buildings.b_townhall;hall.height=78;hall.footprint={width:80,depth:70};
  return {layout,buildings};
}
