import type { Building, Citizen } from '@echo/shared';
import type { WorldState } from '../world.js';
const hash=(s:string)=>Array.from(s).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
export function schedule(state:WorldState,tick:number,hour:number):void{
  const day=Math.floor(tick/288)+1,weekend=day%7===0||day%7===6;
  const buildings=Object.values(state.buildings);
  for(const c of Object.values(state.citizens)){
    if(!c.alive){c.currentActivity='dead';c.destinationBuildingId=null;continue;}
    const n=hash(c.id),shift=(n%3-1)*0.5;
    const nearby=(types:Building['type'][],salt:number)=>{const choices=buildings.filter(b=>types.includes(b.type)).sort((a,b)=>Math.hypot(a.position.x-c.position.x,a.position.y-c.position.y)-Math.hypot(b.position.x-c.position.x,b.position.y-c.position.y)).slice(0,5);return choices[(n+day+salt)%Math.max(1,choices.length)]?.id??c.homeId;};
    let target:string|null=null;let activity:Citizen['currentActivity']='idle';
    if(hour>=23||hour<7+shift){activity='sleeping';target=c.homeId;}
    else if(hour>=11.5&&hour<13||hour>=18.5&&hour<20){activity='eating';target=nearby(['restaurant','grocery'],1);}
    else if(!weekend&&c.workBuildingId&&hour>=8+shift&&hour<17+shift){activity=hour>=12&&hour<13?'eating':'working';target=c.workBuildingId;}
    else if(hour>=12&&hour<13){activity='eating';target=nearby(['restaurant','grocery'],1);}
    else if(hour>=17&&hour<22||weekend&&hour>=10&&hour<17){
      activity='leisure';
      if((n+day)%4===0){const friends=Object.values(state.relationships).filter(r=>(r.aId===c.id||r.bId===c.id)&&r.affection>0.3).map(r=>state.citizens[r.aId===c.id?r.bId:r.aId]).filter(f=>f?.alive&&f.homeId);target=friends[(n+day)%Math.max(1,friends.length)]?.homeId??nearby(['park','restaurant','bar'],2);}
      else target=nearby(c.psychology.extraversion>0.55?['bar','restaurant','park']:['park','shop','grocery'],3);
    }else if(hour>=7&&hour<9){activity='shopping';target=nearby(['grocery','shop'],4);}
    else target=c.homeId;
    c.currentActivity=activity;
    // Finish an existing trip before changing plans. Do not reissue a trip after arrival.
    if(!c.destinationBuildingId&&target){const b=state.buildings[target];if(b&&Math.hypot(c.position.x-b.position.x,c.position.y-b.position.y)>1)c.destinationBuildingId=target;}
  }
}
