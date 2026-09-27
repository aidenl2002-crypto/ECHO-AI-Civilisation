import { corners, hash, seed, type CityBuilding, type Point, type Scene, type Tree } from './cityGeometry';

export type Project = (x: number, y: number, z?: number) => Point;
export type Pick = { kind: 'building' | 'citizen'; id: string; polygons: Point[][]; x: number; y: number; w: number; h: number };
export const polygon = (ctx: CanvasRenderingContext2D, points: Point[], fill: string, stroke?: string, lineWidth=.6) => {
  if(!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y); for(const p of points.slice(1)) ctx.lineTo(p.x,p.y); ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
};
export function line(ctx:CanvasRenderingContext2D,points:Point[],color:string,width:number) {
  if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
export function ellipse(ctx:CanvasRenderingContext2D,p:Point,rx:number,ry:number,color:string){ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
export function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();}
function strip(ctx:CanvasRenderingContext2D,a:Point,b:Point,width:number,at:Project,color:string,z=0){const len=Math.hypot(b.x-a.x,b.y-a.y);if(!len)return;const nx=-(b.y-a.y)/len*width/2,ny=(b.x-a.x)/len*width/2;polygon(ctx,[at(a.x+nx,a.y+ny,z),at(b.x+nx,b.y+ny,z),at(b.x-nx,b.y-ny,z),at(a.x-nx,a.y-ny,z)],color);}

export function terrain(ctx:CanvasRenderingContext2D,scene:Scene,at:Project,scale:number,width:number,height:number,night:boolean){
  const {layout:l}=scene;
  const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#aabc96');bg.addColorStop(.52,'#c4cda6');bg.addColorStop(1,'#9ab595');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  polygon(ctx,l.boundary.map(p=>at(p.x,p.y)), '#c6c8a7','#a8b591',Math.max(1,3*scale));
  // Administrative boundaries are not physical terrain seams. Local architecture
  // gives each district its identity; soft landscape washes avoid a painted board.
  for(const d of l.districts){
    const p=at(d.center.x,d.center.y),radius=Math.max(110,620*scale),wash=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
    wash.addColorStop(0,d.kind==='industrial'?'rgba(155,159,149,.23)':d.kind==='suburb'?'rgba(112,149,99,.23)':'rgba(221,211,183,.25)');wash.addColorStop(1,'rgba(195,201,166,0)');
    ctx.fillStyle=wash;ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
  }
  for(const water of l.water){
    const points=water.map(p=>at(p.x,p.y));polygon(ctx,points,'#5e9d9e','#d8d4b4',Math.max(3,13*scale));
    polygon(ctx,points,'#77afb0','#94c2b6',Math.max(1,3*scale));
    // Water texture follows the river polygon, clipped to the real shoreline.
    ctx.save();ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
    for(let n=0;n<260;n++){const p=at(hash(n+31)*l.width,hash(n+761)*l.height);line(ctx,[p,{x:p.x+15+hash(n)*28*scale,y:p.y}], 'rgba(231,249,225,.23)',1);}
    ctx.restore();
  }
  for(const g of l.greenSpaces){
    polygon(ctx,g.polygon.map(p=>at(p.x,p.y)),g.kind==='plaza'?'#e4d9bc':g.kind==='woodland'?'#8eac7e':'#a5be87','#b6c298',.6);
    if(g.kind==='park'||g.kind==='plaza'){
      const cx=g.polygon.reduce((n,p)=>n+p.x,0)/g.polygon.length,cy=g.polygon.reduce((n,p)=>n+p.y,0)/g.polygon.length;
      for(const p of g.polygon.filter((_,i)=>i%2===0))strip(ctx,p,{x:cx,y:cy},g.kind==='plaza'?9:6,at,'#e6dbb8');
      if(g.kind==='plaza'){ellipse(ctx,at(cx,cy),22*scale,13*scale,'#bab8a4');ellipse(ctx,at(cx,cy,2),18*scale,10*scale,'#edf0d8');ellipse(ctx,at(cx,cy,3),14*scale,8*scale,'#75aeb0');line(ctx,[at(cx,cy,3),at(cx,cy,19)],'#e5f3e1',Math.max(1,2*scale));}
      if(scale>.3)for(let n=0;n<4;n++){
        const angle=n*Math.PI/2,x=cx+Math.cos(angle)*48,y=cy+Math.sin(angle)*48;
        line(ctx,[at(x-6,y,3),at(x+6,y,3)],'#947c59',Math.max(1,3*scale));
        line(ctx,[at(x-5,y,0),at(x-5,y,4)],'#66735d',Math.max(.5,scale));line(ctx,[at(x+5,y,0),at(x+5,y,4)],'#66735d',Math.max(.5,scale));
        ellipse(ctx,at(x+14,y),4*scale,2.3*scale,'#858f6c');ellipse(ctx,at(x+14,y,5),5*scale,3.5*scale,'#92ab68');
      }
    }
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  // Geometry is drawn in world space so avenues keep their true width at every bearing.
  for(const road of l.roads)for(let i=1;i<road.points.length;i++)strip(ctx,road.points[i-1],road.points[i],road.width+11,at,'#e0d9c2');
  for(const road of l.roads)for(let i=1;i<road.points.length;i++)strip(ctx,road.points[i-1],road.points[i],road.width+2,at,'#9b9f94');
  for(const road of l.roads)for(let i=1;i<road.points.length;i++)strip(ctx,road.points[i-1],road.points[i],road.width,at,road.kind==='pedestrian'?'#d5c7aa':road.kind==='arterial'?'#7e8985':'#929990');
  for(const road of l.roads){
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;
      if(road.kind==='main'||road.kind==='arterial'){
        for(let t=10;t<len-12;t+=30)strip(ctx,{x:a.x+dx*t/len,y:a.y+dy*t/len},{x:a.x+dx*Math.min(t+12,len)/len,y:a.y+dy*Math.min(t+12,len)/len},1.4,at,'#d8d8bd',.15);
        if(scale>.28)for(const end of [24,len-25])for(let n=-road.width*.36;n<road.width*.38;n+=5){const nx=-dy/len,ny=dx/len;strip(ctx,{x:a.x+dx*(end-3)/len+nx*n,y:a.y+dy*(end-3)/len+ny*n},{x:a.x+dx*(end+3)/len+nx*n,y:a.y+dy*(end+3)/len+ny*n},2.7,at,'#dadccd',.2);}
      }
      if(scale>.5&&road.kind!=='pedestrian')for(let t=46;t<len-40;t+=145){
        const x=a.x+dx*t/len-dy/len*(road.width/2+4),y=a.y+dy*t/len+dx/len*(road.width/2+4),top=at(x,y,20);
        line(ctx,[at(x,y),top,{x:top.x+4*scale,y:top.y}], '#657a72',Math.max(.7,1.5*scale));ellipse(ctx,{x:top.x+4*scale,y:top.y},2.7*scale,1.5*scale,night?'#ffda83':'#dfe3d0');
        if(night)ellipse(ctx,at(x,y),13*scale,6*scale,'rgba(255,212,119,.12)');
      }
    }
  }
  // Quiet, considered urban plots: courtyards, paved industrial yards, front gardens.
  for(const b of scene.buildings){
    const d=l.districts.find(d=>d.id===b.districtId),kind=d?.kind;
    if(b.type==='park')continue;
    polygon(ctx,corners(b,kind==='suburb'?10:5).map(p=>at(p.x,p.y)),kind==='industrial'?'#b6b6a5':kind==='suburb'?'#a4b980':'#dbd2b8');
    if(b.type==='factory'||b.type==='warehouse'){
      const cs=corners(b,10);line(ctx,cs.concat(cs[0]).map(p=>at(p.x,p.y)), '#9aab9a',Math.max(.5,scale));
      // Parking bays and loading pallets are environmental props on real business lots.
      const a=b.rotation??0,c=Math.cos(a),s=Math.sin(a),bw=b.footprint?.width??35,bd=b.footprint?.depth??35;
      const local=(x:number,y:number,z=0)=>at(b.x+x*c-y*s,b.y+x*s+y*c,z);
      if(scale>.25)for(let n=0;n<Math.floor(bw/12);n++){
        const x=-bw/2+n*12;
        line(ctx,[local(x,bd/2+2),local(x,bd/2+9)],'#e5dfc5',Math.max(.5,scale));
        if(hash(seed(b.id)+n)>.4){
          polygon(ctx,[local(x+2,bd/2+3),local(x+9,bd/2+3),local(x+9,bd/2+8),local(x+2,bd/2+8)],n%2?'#b8c7bd':'#bba68a','#818f82',.4);
          polygon(ctx,[local(x+4,bd/2+4,1),local(x+7,bd/2+4,1),local(x+7,bd/2+7,1),local(x+4,bd/2+7,1)],'#78938e');
        }
      }
    }else if(kind==='suburb'){
      const cs=corners(b,8);line(ctx,[cs[0],cs[1],cs[2]].map(p=>at(p.x,p.y,2)),'#829b6d',Math.max(.5,2*scale));
      if(scale>.35){const p=cs[2];ellipse(ctx,at(p.x-3,p.y-3,2),5*scale,2.5*scale,'#718e5e');ellipse(ctx,at(p.x-3,p.y-3,3),2*scale,1.3*scale,'#d9b277');}
    }
    if(b.entrance)strip(ctx,{x:b.x,y:b.y},b.entrance,5,at,'#d9cbae');
  }
}

export function drawTree(ctx:CanvasRenderingContext2D,t:Tree,at:Project,scale:number){
  const p=at(t.x,t.y),h=t.size;
  ellipse(ctx,{x:p.x+6*scale,y:p.y+2*scale},h*.65*scale,h*.23*scale,'rgba(54,78,57,.16)');
  line(ctx,[p,at(t.x,t.y,h*.85)],'#7e7659',Math.max(.7,2*scale));
  const color=t.hue>.85?'#ada66b':t.hue>.4?'#648d61':'#4f7e62';
  ellipse(ctx,at(t.x,t.y,h),h*.48*scale,h*.62*scale,color);
  ellipse(ctx,at(t.x-h*.13,t.y-h*.12,h*1.2),h*.32*scale,h*.38*scale,t.hue>.85?'#c7bd81':'#8baa72');
}

export function buildingHeight(b:CityBuilding){return b.height??(b.type==='town_hall'?48:b.type==='factory'?32:30);}
export function drawBuilding(ctx:CanvasRenderingContext2D,b:CityBuilding,scene:Scene,at:Project,scale:number,night:boolean,overlay:string,selected:boolean):{pick:Pick;anchor:Point}{
  const h=b.type==='park'?0:buildingHeight(b),world=corners(b),base=world.map(p=>at(p.x,p.y)),top=world.map(p=>at(p.x,p.y,h));
  const d=scene.layout.districts.find(v=>v.id===b.districtId),kind=d?.kind,sh=hash(seed(b.id));
  const tall=h>65,industrial=/factory|warehouse/.test(b.type),pitched=!tall&&!industrial&&b.type!=='clinic'&&b.type!=='police'&&b.type!=='bank';
  let left=kind==='downtown'?(sh>.5?'#729391':'#8b9fa0'):kind==='industrial'?'#bbbcb0':kind==='old_town'?(sh>.5?'#d2b58c':'#c88f77'):kind==='suburb'?'#e7d6ae':kind==='entertainment'?'#cbb29e':'#dacdb0';
  let right=kind==='downtown'?(sh>.5?'#496e76':'#657e87'):kind==='industrial'?'#87958e':kind==='old_town'?(sh>.5?'#a79175':'#a36f62'):kind==='suburb'?'#b7b392':kind==='entertainment'?'#a0877a':'#aaa58f';
  let roof=pitched?(kind==='suburb'?(sh>.6?'#899894':'#c38869'):kind==='old_town'?'#b87860':'#b39072'):tall?'#c6d3ca':industrial?'#9aa8a2':'#c7c5ae';
  if(overlay==='wealth'){left=(b.funds??0)>10000?'#71ba90':'#d7a179';right=(b.funds??0)>10000?'#4b977e':'#af7a65';roof=(b.funds??0)>10000?'#9dd3ac':'#e6bd87';}
  if(b.type==='park'){
    ellipse(ctx,at(b.x,b.y),22*scale,13*scale,'#90b279');
    return {anchor:at(b.x,b.y,15),pick:{kind:'building',id:b.id,polygons:[base],x:Math.min(...base.map(p=>p.x)),y:Math.min(...base.map(p=>p.y)),w:Math.max(...base.map(p=>p.x))-Math.min(...base.map(p=>p.x)),h:Math.max(...base.map(p=>p.y))-Math.min(...base.map(p=>p.y))}};
  }
  // Directional shadows are architectural, including high-rise silhouettes.
  polygon(ctx,[...base.slice(0,2),...world.slice(0,2).reverse().map(p=>at(p.x+h*.4,p.y+h*.24))],'rgba(61,78,68,.17)');
  if(selected)polygon(ctx,corners(b,6).map(p=>at(p.x,p.y,1)),'rgba(244,181,94,.3)','#edb660',2);
  const surfaces:Point[][]=[];
  const edges=[0,1,2,3].filter(i=>{const a=base[i],c=base[(i+1)%4];return c.x<a.x;}).sort((a,b)=>(base[a].y+base[(a+1)%4].y)-(base[b].y+base[(b+1)%4].y));
  for(const i of edges){
    const j=(i+1)%4,a=base[i],c=base[j],ta=top[i],tc=top[j],face=[a,c,tc,ta];surfaces.push(face);
    const facade=(c.y-a.y)>0?left:right;polygon(ctx,face,facade,'rgba(64,74,66,.16)',.5);
    const worldWidth=Math.hypot(world[i].x-world[j].x,world[i].y-world[j].y);
    const cols=Math.max(2,Math.floor(worldWidth/(tall?10:12))),floors=Math.max(1,Math.floor(h/(tall?13:14)));
    if(scale>.21){
      for(let floor=0;floor<floors;floor++)for(let col=0;col<cols;col++){
        const u=(col+.5)/cols,v=(floor+.45)/floors,ww=(tall?.68:.42)/cols,hh=(industrial?.28:.42)/floors;
        const point=(u:number,v:number)=>({x:a.x+(c.x-a.x)*u,y:a.y+(c.y-a.y)*u+(ta.y-a.y)*v});
        const lit=night&&hash(seed(b.id)+floor*19+col*7+i)>.28;
        polygon(ctx,[point(u-ww/2,v-hh/2),point(u+ww/2,v-hh/2),point(u+ww/2,v+hh/2),point(u-ww/2,v+hh/2)],lit?'#f9d58b':tall?(sh>.5?'#b4c8bf':'#9eb6b5'):'#647c79');
        if(!tall&&scale>.65)line(ctx,[point(u-ww/2,v-hh/2),point(u+ww/2,v-hh/2)],'#e8ddba',Math.max(.7,scale));
      }
      if(tall)for(let floor=1;floor<floors;floor++){const v=floor/floors;line(ctx,[{x:a.x,y:a.y+(ta.y-a.y)*v},{x:c.x,y:c.y+(tc.y-c.y)*v}],'rgba(217,229,211,.4)',Math.max(.5,scale*.7));}
    }
    // Shopfront glazing and colourful striped awnings reveal commercial streets.
    if(/shop|bar|restaurant|grocery/.test(b.type)&&scale>.25){
      const pa=world[i],pb=world[j],atEdge=(u:number,z:number)=>at(pa.x+(pb.x-pa.x)*u,pa.y+(pb.y-pa.y)*u,z);
      polygon(ctx,[atEdge(.14,1),atEdge(.86,1),atEdge(.86,9),atEdge(.14,9)],night?'#f2d799':'#537879');
      const awning=b.type==='bar'?'#788d8f':b.type==='restaurant'?'#ba7868':'#6f9a83';
      for(let n=0;n<8;n++)polygon(ctx,[atEdge(.1+n*.1,10),atEdge(.2+n*.1,10),{...atEdge(.2+n*.1,8),y:atEdge(.2+n*.1,8).y+2*scale},{...atEdge(.1+n*.1,8),y:atEdge(.1+n*.1,8).y+2*scale}],n%2?awning:'#eee1c0');
    }
  }
  polygon(ctx,top,roof,'rgba(245,239,214,.7)',Math.max(.5,scale*.8));surfaces.push(top);
  if(pitched){
    const ridgeA={x:(world[0].x+world[3].x)/2,y:(world[0].y+world[3].y)/2},ridgeB={x:(world[1].x+world[2].x)/2,y:(world[1].y+world[2].y)/2};
    const ra=at(ridgeA.x,ridgeA.y,h+Math.min(14,(b.footprint?.depth??35)*.25)),rb=at(ridgeB.x,ridgeB.y,h+Math.min(14,(b.footprint?.depth??35)*.25));
    const faces=[[top[0],top[1],rb,ra],[top[3],top[2],rb,ra]];faces.sort((a,b)=>a[0].y-b[0].y);
    faces.forEach((face,i)=>{polygon(ctx,face,i?'#b57f66':roof,'rgba(110,76,58,.2)',.5);surfaces.push(face);});
    polygon(ctx,[top[1],top[2],rb],left);polygon(ctx,[top[0],top[3],ra],right);
    line(ctx,[ra,rb],'#dab194',Math.max(.7,scale));
    if(scale>.5)for(let k=1;k<5;k++){const u=k/5;line(ctx,[{x:ra.x+(top[3].x-ra.x)*u,y:ra.y+(top[3].y-ra.y)*u},{x:rb.x+(top[2].x-rb.x)*u,y:rb.y+(top[2].y-rb.y)*u}],'rgba(79,65,54,.13)',.5);}
  }else{
    const inset=world.map(p=>({x:b.x+(p.x-b.x)*.82,y:b.y+(p.y-b.y)*.82}));line(ctx,inset.concat(inset[0]).map(p=>at(p.x,p.y,h+.5)),'rgba(85,108,100,.4)',Math.max(.7,scale));
    if(scale>.28){
      // Roof plants, lift cores, solar banks and warehouse rooflights.
      const ww=b.footprint?.width??35,dd=b.footprint?.depth??35,a=b.rotation??0;
      const roofPoint=(x:number,y:number,z:number)=>at(b.x+x*Math.cos(a)-y*Math.sin(a),b.y+x*Math.sin(a)+y*Math.cos(a),z);
      const roofBox=(x:number,y:number,w:number,d:number,rh:number)=>{
        const q=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],bt=q.map(([a,b])=>roofPoint(a,b,h)),tp=q.map(([a,b])=>roofPoint(a,b,h+rh));
        polygon(ctx,[bt[1],bt[2],tp[2],tp[1]],'#839a94');polygon(ctx,[bt[2],bt[3],tp[3],tp[2]],'#a1b3a6');polygon(ctx,tp,'#e0e0c8');
      };
      roofBox(-ww*.24,-dd*.22,ww*.3,dd*.25,tall?9:4);
      if(industrial)for(let k=0;k<3;k++)polygon(ctx,[roofPoint(-ww*.3+k*ww*.24,dd*.05,h+1),roofPoint(-ww*.16+k*ww*.24,dd*.05,h+1),roofPoint(-ww*.16+k*ww*.24,dd*.32,h+1),roofPoint(-ww*.3+k*ww*.24,dd*.32,h+1)],'#c3d9cf','#7e9894',.5);
      else if(tall){const p=roofPoint(ww*.2,dd*.2,h+2);line(ctx,[p,roofPoint(ww*.2,dd*.2,h+25)],'#637f7c',Math.max(.7,scale));ellipse(ctx,roofPoint(ww*.2,dd*.2,h+25),1.5,1.5,night?'#eaa17a':'#d4b8a1');}
    }
  }
  if(b.type==='town_hall'){
    // A recognisable civic clock tower belongs to this real civic building.
    const p=at(b.x,b.y,h+35),baseP=at(b.x,b.y,h);polygon(ctx,[{x:p.x-7*scale,y:p.y},{x:p.x+7*scale,y:p.y}, {x:baseP.x+7*scale,y:baseP.y},{x:baseP.x-7*scale,y:baseP.y}],'#daccac','#aea589',.7);
    ellipse(ctx,{x:p.x,y:p.y+7*scale},4.3*scale,4.3*scale,'#f2e7c9');line(ctx,[{x:p.x,y:p.y+4*scale},{x:p.x,y:p.y+7*scale},{x:p.x+2*scale,y:p.y+8*scale}],'#707b70',Math.max(.6,scale));
    polygon(ctx,[{x:p.x-10*scale,y:p.y},{x:p.x+10*scale,y:p.y},{x:p.x,y:p.y-12*scale}],'#79958c');
  }
  const pts=surfaces.flat(),minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
  return {anchor:at(b.x,b.y,h+(pitched?17:5)+(b.type==='town_hall'?35:0)),pick:{kind:'building',id:b.id,polygons:surfaces,x:minX,y:minY,w:maxX-minX,h:maxY-minY}};
}
