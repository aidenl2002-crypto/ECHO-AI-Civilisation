import React, { useEffect, useRef, useState } from 'react';
import type { Building, CitizenSummary, CityLayout, Clock, HeatItem } from '../api';
import { createScene, project, groundDelta, rotate, inside, type Camera, type Point } from './cityGeometry';
import { terrain, drawBuilding, drawTree, ellipse, roundRect, type Pick } from './cityPainter';

interface Props {
  citizens: CitizenSummary[]; buildings: Building[]; layout?: CityLayout | null; clock: Clock | null;
  overlay: string; heat: HeatItem[]; selectedCitizenId: string | null; selectedBuildingId: string | null;
  follow: boolean; cinematic: boolean; observer: boolean; pinned: string[];
  routeTo: { x: number; y: number; label: string } | null;
  onSelectCitizen: (id: string | null) => void; onSelectBuilding: (id: string | null) => void;
  onHover: (h: { kind: string; title: string; sub: string; x: number; y: number } | null) => void;
}
const home = (layout?: CityLayout | null): Camera => ({x:(layout?.width??1000)*.45,y:(layout?.height??1000)*.5,zoom:1.08,turn:0});

export default function CityMap3D(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef(props); current.current=props;
  const camera=useRef(home(props.layout)),target=useRef(home(props.layout)),scaleRef=useRef(1),picks=useRef<Pick[]>([]);
  const drag=useRef<{x:number;y:number;distance:number}|null>(null),labels=useRef(true);
  const [hud,setHud]=useState({zoom:108,district:'Echo City'}),[showLabels,setShowLabels]=useState(true);
  useEffect(()=>{
    const el=canvas.current!;const ctx=el.getContext('2d')!;
    // Cache architecture separately so citizen animation does not repaint every facade.
    const backing=document.createElement('canvas'),bg=backing.getContext('2d')!;
    let scene=createScene(current.current.buildings,current.current.layout,''),layout=current.current.layout,key='',last=0,frame=0,hudTime=0;
    let anchors:{b:Building;p:Point}[]=[],staticPicks:Pick[]=[];
    const positions=new Map<string,Point>();
    const render=(now:number)=>{
      frame=requestAnimationFrame(render);if(now-last<30)return;last=now;
      const p=current.current,rect=el.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      // The visible canvas can survive hot reload while its backing canvas is recreated.
      if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)||backing.width!==el.width||backing.height!==el.height){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);backing.width=el.width;backing.height=el.height;key='';}
      const signature=p.buildings.map(b=>`${b.id}:${b.x}:${b.y}:${b.height}:${b.name}`).join('|');
      if(signature!==scene.signature||layout!==p.layout){if(layout!==p.layout){target.current=home(p.layout);camera.current={...target.current};}layout=p.layout;scene=createScene(p.buildings,p.layout,signature);key='';}
      const t=target.current,c=camera.current;
      const followed=p.follow&&p.citizens.find(cit=>cit.id===p.selectedCitizenId);
      if(followed){t.x=followed.x;t.y=followed.y;t.zoom=Math.max(t.zoom,2.6);}
      else if((p.cinematic||p.observer)&&scene.layout.districts.length&&!drag.current){const d=scene.layout.districts[Math.floor(now/16000)%scene.layout.districts.length];t.x=d.center.x;t.y=d.center.y;t.zoom=2;}
      c.x+=(t.x-c.x)*.18;c.y+=(t.y-c.y)*.18;c.zoom+=(t.zoom-c.zoom)*.18;c.turn=t.turn;
      const scale=Math.min(w/((scene.layout.width+scene.layout.height)*.7071),h/((scene.layout.width+scene.layout.height)*.425))*.96*c.zoom;scaleRef.current=scale;
      const at=(x:number,y:number,z=0)=>project(x,y,z,c,w,h,scale);
      const hour=p.clock?.hour??12,night=hour<6||hour>=20;
      const nextKey=[Math.round(c.x),Math.round(c.y),c.zoom.toFixed(3),c.turn,w,h,night,p.overlay,p.selectedBuildingId].join(':');
      if(nextKey!==key){
        key=nextKey;bg.setTransform(dpr,0,0,dpr,0,0);terrain(bg,scene,at,scale,w,h,night);staticPicks=[];anchors=[];
        const entities=[...scene.buildings.map(b=>({x:b.x,y:b.y,b,tree:null})),...scene.trees.map(tree=>({x:tree.x,y:tree.y,b:null,tree}))];
        // Sort in camera space so nearer buildings obscure farther ones after rotation.
        entities.sort((a,b)=>{const aa=rotate(a.x,a.y,c.turn),bb=rotate(b.x,b.y,c.turn);return aa.x+aa.y-bb.x-bb.y;});
        for(const e of entities){const pt=at(e.x,e.y);if(pt.x<-180||pt.x>w+180||pt.y<-100||pt.y>h+250)continue;
          if(e.tree)drawTree(bg,e.tree,at,scale);else if(e.b){const drawn=drawBuilding(bg,e.b,scene,at,scale,night,p.overlay,e.b.id===p.selectedBuildingId);staticPicks.push(drawn.pick);anchors.push({b:e.b,p:drawn.anchor});}}
        if(night){bg.fillStyle='rgba(17,32,59,.30)';bg.fillRect(0,0,w,h);}
      }
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,el.width,el.height);ctx.drawImage(backing,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);picks.current=[...staticPicks];
      for(const citizen of p.citizens){
        // Smooth between API snapshots for display only; simulation positions stay authoritative.
        const old=positions.get(citizen.id)??{x:citizen.x,y:citizen.y};old.x+=(citizen.x-old.x)*.16;old.y+=(citizen.y-old.y)*.16;positions.set(citizen.id,old);
        const selected=citizen.id===p.selectedCitizenId;if(!selected&&citizen.activity==='sleeping')continue;
        const pt=at(old.x,old.y,3);if(pt.x<0||pt.x>w||pt.y<0||pt.y>h)continue;
        const radius=selected?4:Math.max(1.4,3.4*scale),color=p.overlay==='happiness'?(citizen.mood>60?'#249b83':'#d77a55'):p.overlay==='wealth'?(citizen.wealth>2000?'#249b83':'#d77a55'):p.overlay==='ai'?(p.heat.some(v=>v.id===citizen.id&&v.attention>0)?'#9d63d1':'#577e7d'):'#285d61';
        ellipse(ctx,{x:pt.x+2,y:pt.y+3},radius*1.4,radius*.6,'#415b4530');
        if(selected){ctx.strokeStyle='#fff3c9';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(pt.x,pt.y+2,10,5,0,0,Math.PI*2);ctx.stroke();}
        ellipse(ctx,pt,radius,radius*1.4,color);if(scale>.45)ellipse(ctx,{x:pt.x,y:pt.y-radius*1.7},radius*.65,radius*.65,'#f0ce9e');
        picks.current.push({kind:'citizen',id:citizen.id,polygons:[],x:pt.x-7,y:pt.y-10,w:14,h:18});
        if(selected){ctx.font='600 12px sans-serif';ctx.textAlign='center';ctx.fillStyle=night?'#fff1cc':'#234746';ctx.fillText(citizen.name,pt.x,pt.y-18);}
      }
      if(labels.current){
        if(c.zoom<1.9){for(const d of scene.layout.districts){const pt=at(d.center.x,d.center.y,12);ctx.textAlign='center';ctx.font='600 12px sans-serif';ctx.lineWidth=4;ctx.strokeStyle=night?'#243f4a':'#e0dfc7';ctx.strokeText(d.name.toUpperCase(),pt.x,pt.y);ctx.fillStyle=night?'#ece4c7':'#415a51';ctx.fillText(d.name.toUpperCase(),pt.x,pt.y);}}
        const occupied:{x:number;y:number;w:number;h:number}[]=[];
        anchors.sort((a,b)=>Number(b.b.id===p.selectedBuildingId)-Number(a.b.id===p.selectedBuildingId));
        for(const a of anchors){const selected=a.b.id===p.selectedBuildingId,pinned=p.pinned.includes(a.b.id);if(!selected&&!pinned&&(c.zoom<2?!['b_townhall','b_bank','b_park'].includes(a.b.id):a.b.type==='home'&&c.zoom<3.6))continue;
          ctx.font='500 11px sans-serif';const name=a.b.name,tw=ctx.measureText(name).width+16,x=a.p.x-tw/2,y=a.p.y-25;
          if(x<8||x+tw>w-8||y<45||y>h-55||(!selected&&occupied.some(r=>x<r.x+r.w+5&&x+tw>r.x-5&&y<r.y+r.h+5&&y+20>r.y-5)))continue;
          occupied.push({x,y,w:tw,h:20});roundRect(ctx,x,y,tw,20,5,selected?'#244f4a':night?'#253b48ed':'#fff9e9ec');ctx.fillStyle=selected||night?'#fff2d1':'#354d48';ctx.textAlign='center';ctx.fillText(name,x+tw/2,y+14);
          picks.current.push({kind:'building',id:a.b.id,polygons:[],x,y,w:tw,h:20});
        }
      }
      if(now-hudTime>500){hudTime=now;const district=scene.layout.districts.find(d=>inside(c,d.polygon));setHud({zoom:Math.round(c.zoom*100),district:district?.name??'Echo City'});}
    };
    frame=requestAnimationFrame(render);return()=>cancelAnimationFrame(frame);
  },[]);
  const zoom=(factor:number)=>{target.current.zoom=Math.max(.65,Math.min(8,target.current.zoom*factor));};
  const hitAt=(x:number,y:number)=>{const r=canvas.current!.getBoundingClientRect(),pt={x:x-r.left,y:y-r.top};return [...picks.current].reverse().find(p=>pt.x>=p.x&&pt.x<=p.x+p.w&&pt.y>=p.y&&pt.y<=p.y+p.h&&(!p.polygons.length||p.polygons.some(poly=>inside(pt,poly))));};
  return <div className="mapbox mapbox-3d"><canvas ref={canvas} aria-label="Interactive Echo City map" onWheel={e=>{zoom(e.deltaY<0?1.13:.885);}} onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,distance:0};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{
    if(drag.current){const d=drag.current,dx=e.clientX-d.x,dy=e.clientY-d.y,delta=groundDelta(dx,dy,camera.current,scaleRef.current);target.current.x-=delta.x;target.current.y-=delta.y;d.distance+=Math.hypot(dx,dy);d.x=e.clientX;d.y=e.clientY;current.current.onHover(null);return;}
    const hit=hitAt(e.clientX,e.clientY),r=e.currentTarget.getBoundingClientRect(),p=current.current;
    const item=hit?.kind==='building'?p.buildings.find(b=>b.id===hit.id):p.citizens.find(c=>c.id===hit?.id);
    p.onHover(hit&&item?{kind:hit.kind,title:item.name,sub:hit.kind==='building'?[(item as Building).districtName,(item as Building).address].filter(Boolean).join(' · '):((item as CitizenSummary).activity ?? 'Exploring'),x:e.clientX-r.left,y:e.clientY-r.top}:null);
  }} onPointerUp={e=>{const moved=(drag.current?.distance??0)>5;drag.current=null;if(moved)return;const hit=hitAt(e.clientX,e.clientY);if(hit?.kind==='building')current.current.onSelectBuilding(hit.id);else if(hit)current.current.onSelectCitizen(hit.id);else{current.current.onSelectBuilding(null);current.current.onSelectCitizen(null);}}} onPointerCancel={()=>{drag.current=null;}} onPointerLeave={()=>current.current.onHover(null)} onDoubleClick={e=>{const r=e.currentTarget.getBoundingClientRect(),delta=groundDelta(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height*.53,camera.current,scaleRef.current);target.current.x+=delta.x;target.current.y+=delta.y;zoom(1.5);}} />
    <div className="map-3d-controls" aria-label="Map camera controls"><button aria-label="Rotate city left" onClick={()=>{target.current.turn=(target.current.turn+3)%4;}}>↶</button><span>{hud.district} · {hud.zoom}%</span><button aria-label="Rotate city right" onClick={()=>{target.current.turn=(target.current.turn+1)%4;}}>↷</button><button aria-label="Zoom out" onClick={()=>zoom(.8)}>−</button><button aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button><button aria-label="Toggle building names" aria-pressed={showLabels} onClick={()=>{labels.current=!labels.current;setShowLabels(labels.current);}}>Aa</button><button aria-label="Reset camera" onClick={()=>{target.current=home(current.current.layout);}}>⌂</button></div>
  </div>;
}
