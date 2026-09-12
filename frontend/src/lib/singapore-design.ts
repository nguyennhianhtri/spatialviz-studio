import type { RoomDef, SceneGraph } from '../types/scene';
import { boundsOf, catalog, fitsRoom, furnishRoom, itemCorners, type DesignItem, type InteriorDesign, type ItemKind } from './interior-design';
export type SingaporeHomeStyle='hdb'|'condo';
const spec=(kind:ItemKind)=>catalog.find(c=>c.kind===kind)!;
const box=(i:DesignItem)=>{const p=itemCorners(i);return {x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),z0:Math.min(...p.map(v=>v[1])),z1:Math.max(...p.map(v=>v[1]))};};
function overlaps(a:DesignItem,b:DesignItem){if(a.kind==='rug'||b.kind==='rug'||spec(a.kind).mount||spec(b.kind).mount)return false;const x=box(a),y=box(b);return x.x0<y.x1+.07&&x.x1>y.x0-.07&&x.z0<y.z1+.07&&x.z1>y.z0-.07;}
/** A design proposal, never extracted architecture: locate carpentry only on clear source room edges. */
function againstWall(kind:ItemKind,room:RoomDef,scene:SceneGraph,items:DesignItem[],color:string,near?:[number,number]):DesignItem|null{
 const s=spec(kind),p=room.polygon,area=p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-b[0]*a[1];},0);
 const choices:DesignItem[]=[];
 for(let i=0;i<p.length;i++){
  const a=p[area>=0?i:(p.length-i)%p.length],b=p[area>=0?(i+1)%p.length:(p.length-i-1+p.length)%p.length];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<s.width+.14)continue;
  const ux=dx/length,uz=dz/length;
  for(let t=s.width/2+.07;t<=length-s.width/2-.07+.001;t+=.15){
   const wx=a[0]+ux*t,wz=a[1]+uz*t;
   if([...(scene.doors||[]),...(scene.windows||[])].some(o=>{const ox=o.position[0]-a[0],oz=o.position[1]-a[1];return Math.abs(ox*uz-oz*ux)<.12&&Math.abs(ox*ux+oz*uz-t)<(o.width_m+s.width)/2+.12;}))continue;
   const item:DesignItem={id:`${room.id}-sg-${kind}`,roomId:room.id,kind,x:wx-uz*(s.depth/2+.035),z:wz+ux*(s.depth/2+.035),rotation:(Math.atan2(-uz,ux)*180/Math.PI+360)%360,scale:1,color};
   if(fitsRoom(item,room)&&!items.some(other=>overlaps(item,other)))choices.push(item);
  }
 }
 if(near)choices.sort((a,b)=>Math.hypot(a.x-near[0],a.z-near[1])-Math.hypot(b.x-near[0],b.z-near[1]));
 return choices[0]||null;
}
export function placeSingaporeFitting(kind:ItemKind,room:RoomDef,scene:SceneGraph,items:DesignItem[],id:string):DesignItem|null{
 const s=spec(kind);if(s.mount==='ceiling'){
  const b=boundsOf(room);const item:DesignItem={id,kind,roomId:room.id,x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,rotation:0,scale:1,color:s.color};
  return fitsRoom(item,room)?item:null;
 }
 const item=againstWall(kind,room,scene,items,s.color);return item?{...item,id}:null;
}
export function designSingaporeHome(scene:SceneGraph,style:SingaporeHomeStyle):InteriorDesign{
 const design:InteriorDesign={items:[],finishes:{}};
 const living=scene.rooms.filter(r=>['living','living_dining','dining'].includes(r.type)).sort((a,b)=>b.area_sqm-a.area_sqm)[0];
 const mainDoor=scene.doors?.find(d=>d.type==='main_entrance');
 for(const room of scene.rooms){
  const b=boundsOf(room),centre:[number,number]=[(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2];
  const wet=['kitchen','bathroom','wc','yard','service_yard','balcony'].includes(room.type);
  design.finishes[room.id]={floor:room.type==='bedroom'?(style==='hdb'?'wood_light':'wood_dark'):wet||style==='hdb'?'tile_white':'concrete',wall:style==='hdb'?'#f3efe6':'#e9e5df'};
  let items=furnishRoom(room,scene.doors).filter(i=>!['floor-lamp','island'].includes(i.kind));
  const timber=style==='hdb'?'#ba9b73':'#71665c';
  items=items.map(i=>({...i,color:['wardrobe','console','nightstand','coffee-table','desk'].includes(i.kind)?timber:i.kind==='sofa'?(style==='hdb'?'#d9d3c6':'#b9b4ac'):i.color}));
  const addWall=(kind:ItemKind,color:string,near?:[number,number])=>{const placed=againstWall(kind,room,scene,items,color,near);if(placed)items.push(placed);return placed;};
  const addCeiling=(kind:ItemKind,color:string)=>{const item:DesignItem={id:`${room.id}-sg-${kind}`,roomId:room.id,kind,x:centre[0],z:centre[1],rotation:0,scale:1,color};if(fitsRoom(item,room))items.push(item);};
  if(room.id===living?.id){
   const old=items.find(i=>i.kind==='console');items=items.filter(i=>i.kind!=='console');
   const tv=addWall('tv-wall',timber,old?[old.x,old.z]:undefined);if(!tv&&old)items.push(old);
   const sofa=items.find(i=>i.kind==='sofa');
   if(tv&&sofa){
    const a=tv.rotation*Math.PI/180,seat={...sofa,x:tv.x+Math.sin(a)*2.35,z:tv.z+Math.cos(a)*2.35,rotation:(tv.rotation+180)%360};
    const sb=box(seat);seat.x+=Math.max(0,b.minX+.12-sb.x0)-Math.max(0,sb.x1-b.maxX+.12);seat.z+=Math.max(0,b.minZ+.12-sb.z0)-Math.max(0,sb.z1-b.maxZ+.12);
    const others=items.filter(i=>!['sofa','coffee-table','rug'].includes(i.kind));
    const q=box(seat),doorBlocked=scene.doors.some(d=>Math.hypot(Math.max(q.x0-d.position[0],0,d.position[0]-q.x1),Math.max(q.z0-d.position[1],0,d.position[1]-q.z1))<.65);
    if(fitsRoom(seat,room)&&!doorBlocked&&!others.some(i=>overlaps(seat,i))){
     const coffee=items.find(i=>i.kind==='coffee-table'),rug=items.find(i=>i.kind==='rug');items=[...others,seat];
     if(coffee){const table={...coffee,x:seat.x-Math.sin(a)*1.08,z:seat.z-Math.cos(a)*1.08,rotation:seat.rotation};if(fitsRoom(table,room)&&!items.some(i=>overlaps(table,i)))items.push(table);}
     if(rug){const mat={...rug,x:seat.x-Math.sin(a)*.65,z:seat.z-Math.cos(a)*.65,rotation:seat.rotation,scale:.85};if(fitsRoom(mat,room))items.push(mat);}
    }else{items=items.filter(i=>i.id!==tv.id);if(old)items.push(old);}
   }
   addWall('shoe-cabinet',timber,mainDoor?.position||[b.minX,b.minZ]);
   addWall('aircon','#efeee8');addCeiling('ceiling-fan',style==='hdb'?'#ac8c63':'#403f3b');
  }else if(room.type==='bedroom'){
   addWall('aircon','#efeee8');if(style==='hdb')addCeiling('ceiling-fan','#eee9df');
  }else if(room.type==='kitchen'){
   const old=items.find(i=>i.kind==='kitchen');items=items.filter(i=>i.kind!=='kitchen'&&i.kind!=='plant');
   const kitchen=addWall('sg-kitchen',style==='hdb'?'#aeb29e':'#6e7168',old?[old.x,old.z]:undefined);if(!kitchen&&old)items.push(old);
  }else if(['yard','service_yard'].includes(room.type)){
   items=[];addWall(style==='hdb'?'washer':'laundry-tower',style==='hdb'?'#e8e7e1':'#bdb6aa');
   if(style==='hdb')addCeiling('drying-rack','#dfded7');
  }
  design.items.push(...items);
 }
 return design;
}
