import type { RoomDef, SceneGraph } from '../types/scene';

export type ItemKind = 'sofa'|'armchair'|'coffee-table'|'rug'|'bed'|'nightstand'|'wardrobe'|'dining-table'|'chair'|'plant'|'floor-lamp'|'console'|'kitchen'|'island'|'vanity'|'toilet'|'shower'|'desk';
export interface DesignItem { id:string; roomId:string; kind:ItemKind; x:number; z:number; rotation:number; scale:number; color:string; }
export interface RoomFinish { floor:string; wall:string; }
export interface InteriorDesign { items:DesignItem[]; finishes:Record<string,RoomFinish>; }
export const catalog: {kind:ItemKind; name:string; width:number; depth:number; color:string; category:string}[] = [
 {kind:'sofa',name:'Linen sofa',width:2.4,depth:1,color:'#d3c4b1',category:'Living'},
 {kind:'armchair',name:'Lounge chair',width:.85,depth:.9,color:'#b58461',category:'Living'},
 {kind:'coffee-table',name:'Oak coffee table',width:1.15,depth:.65,color:'#a5784e',category:'Living'},
 {kind:'rug',name:'Woven rug',width:2.6,depth:1.8,color:'#c9bda9',category:'Decor'},
 {kind:'bed',name:'Upholstered bed',width:1.65,depth:2.15,color:'#d5c5b8',category:'Bedroom'},
 {kind:'nightstand',name:'Bedside table',width:.45,depth:.4,color:'#a5784e',category:'Bedroom'},
 {kind:'wardrobe',name:'Built-in wardrobe',width:1.8,depth:.6,color:'#c9bca9',category:'Bedroom'},
 {kind:'dining-table',name:'Round dining set',width:1.7,depth:1.7,color:'#a5784e',category:'Living'},
 {kind:'chair',name:'Dining chair',width:.5,depth:.55,color:'#a5784e',category:'Living'},
 {kind:'plant',name:'Fiddle-leaf fig',width:.55,depth:.55,color:'#6c8060',category:'Decor'},
 {kind:'floor-lamp',name:'Arc floor lamp',width:.55,depth:.55,color:'#c6a570',category:'Decor'},
 {kind:'console',name:'Media console',width:1.8,depth:.4,color:'#a5784e',category:'Living'},
 {kind:'kitchen',name:'Kitchen run',width:2.4,depth:.65,color:'#b8baa8',category:'Kitchen'},
 {kind:'island',name:'Kitchen island',width:1.5,depth:.8,color:'#b8baa8',category:'Kitchen'},
 {kind:'vanity',name:'Bathroom vanity',width:.8,depth:.5,color:'#a5784e',category:'Bathroom'},
 {kind:'toilet',name:'WC',width:.42,depth:.7,color:'#f5f2ec',category:'Bathroom'},
 {kind:'shower',name:'Glass shower',width:.85,depth:.85,color:'#dedcd5',category:'Bathroom'},
 {kind:'desk',name:'Writing desk',width:1.15,depth:.6,color:'#a5784e',category:'Bedroom'},
];
export const boundsOf=(room:RoomDef)=>{const xs=room.polygon.map(p=>p[0]),zs=room.polygon.map(p=>p[1]);return {minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};};
function inside(x:number,z:number,polygon:number[][]){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))yes=!yes;}return yes;}
export function itemCorners(item:DesignItem){const spec=catalog.find(c=>c.kind===item.kind)!;const a=item.rotation*Math.PI/180;return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>{const dx=x*spec.width*item.scale/2,dz=z*spec.depth*item.scale/2;return [item.x+dx*Math.cos(a)+dz*Math.sin(a),item.z-dx*Math.sin(a)+dz*Math.cos(a)];});}
export function fitsRoom(item:DesignItem,room:RoomDef){return itemCorners(item).every(([x,z])=>inside(x,z,room.polygon));}
function conflicts(item:DesignItem,items:DesignItem[]){if(item.kind==='rug')return false;const a=itemCorners(item);return items.filter(x=>x.kind!=='rug'&&x.id!==item.id).some(other=>{const b=itemCorners(other);return Math.min(...a.map(p=>p[0]))<Math.max(...b.map(p=>p[0]))+.08&&Math.max(...a.map(p=>p[0]))>Math.min(...b.map(p=>p[0]))-.08&&Math.min(...a.map(p=>p[1]))<Math.max(...b.map(p=>p[1]))+.08&&Math.max(...a.map(p=>p[1]))>Math.min(...b.map(p=>p[1]))-.08;});}
export function placeItem(kind:ItemKind,room:RoomDef,items:DesignItem[],id:string):DesignItem|null{
 const spec=catalog.find(c=>c.kind===kind);if(!spec)return null;const b=boundsOf(room),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
 const initial={id,roomId:room.id,kind,x:cx,z:cz,rotation:0,scale:1,color:spec.color};
 if(fitsRoom(initial,room)&&!conflicts(initial,items))return initial;
 for(const rotation of [0,90]) for(let z=b.minZ+.25;z<b.maxZ;z+=.25) for(let x=b.minX+.25;x<b.maxX;x+=.25){const candidate={...initial,x,z,rotation};if(fitsRoom(candidate,room)&&!conflicts(candidate,items))return candidate;}
 return null;
}
export function moveItem(item:DesignItem,patch:Partial<DesignItem>,room:RoomDef):DesignItem|null{const next={...item,...patch,id:item.id,roomId:item.roomId,kind:item.kind};if(![next.x,next.z,next.rotation,next.scale].every(Number.isFinite)||next.scale<.5||next.scale>2)return null;return fitsRoom(next,room)?next:null;}
export function furnishRoom(room:RoomDef,doors:SceneGraph['doors']):DesignItem[]{
 const b=boundsOf(room),w=b.maxX-b.minX,d=b.maxZ-b.minZ,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;const items:DesignItem[]=[];
 const put=(kind:ItemKind,x:number,z:number,rotation=0,scale=1)=>{const spec=catalog.find(c=>c.kind===kind)!;
 const candidates=[[x,z,rotation],[x,2*cz-z,(rotation+180)%360],[2*cx-x,z,rotation],[2*cx-x,2*cz-z,(rotation+180)%360]];
 for(const a of [0,90,180,270]){const halfX=(a%180?spec.depth:spec.width)*scale/2+.15,halfZ=(a%180?spec.width:spec.depth)*scale/2+.15;for(const px of [b.minX+halfX,b.maxX-halfX,cx])for(const pz of [b.minZ+halfZ,b.maxZ-halfZ,cz])candidates.push([px,pz,a]);}
 for(const [px,pz,angle] of candidates){
 const item={id:`${room.id}-${kind}-${items.length}`,roomId:room.id,kind,x:px,z:pz,rotation:angle,scale,color:spec.color};
 const blocksDoor=kind!=='rug'&&doors.some(door=>{const corners=itemCorners(item);return door.position[0]>Math.min(...corners.map(p=>p[0]))-.45&&door.position[0]<Math.max(...corners.map(p=>p[0]))+.45&&door.position[1]>Math.min(...corners.map(p=>p[1]))-.45&&door.position[1]<Math.max(...corners.map(p=>p[1]))+.45;});
 if(fitsRoom(item,room)&&!conflicts(item,items)&&!blocksDoor){items.push(item);return item;}
 }
 return null;
 };
 if(['living','dining'].includes(room.type)){
 put('rug',cx,cz);const sofa=put('sofa',cx,b.minZ+.65);put('coffee-table',cx,sofa?sofa.z+(sofa.rotation===180?-1.05:1.05):b.minZ+1.65);put('console',cx,sofa?.rotation===180?b.minZ+.35:b.maxZ-.35,sofa?.rotation===180?180:0);if(w>4.5)put('armchair',b.minX+.65,cz,90);if(d>4.2&&w>4.8)put('dining-table',b.maxX-1,cz+.3);
 put('plant',b.minX+.45,b.maxZ-.45);put('floor-lamp',b.maxX-.4,b.minZ+.4);
 }else if(room.type==='bedroom'){
 put('rug',cx,cz+.35,0,.8);const bed=put('bed',cx,b.minZ+1.2);const bedsideZ=bed?bed.z+(bed.rotation===180?.8:-.8):b.minZ+.4;put('nightstand',cx-1.13,bedsideZ);put('nightstand',cx+1.13,bedsideZ);put('wardrobe',cx,bed?.rotation===180?b.minZ+.42:b.maxZ-.42,bed?.rotation===180?0:180);put('plant',b.maxX-.4,b.maxZ-.4);
 }else if(room.type==='kitchen'){
 put('kitchen',cx,b.minZ+.45);if(w>2.8&&d>2.8)put('island',cx,cz+.4);put('plant',b.maxX-.4,b.maxZ-.4);
 }else if(['bathroom','wc'].includes(room.type)){
 put('toilet',b.minX+.4,b.minZ+.5);if(room.type!=='wc'){put('vanity',b.maxX-.5,b.minZ+.4);put('shower',b.maxX-.55,b.maxZ-.55);}
 }else if(['balcony','yard'].includes(room.type)){
 put('plant',b.minX+.4,b.minZ+.4);put('plant',b.maxX-.4,b.maxZ-.4);if(w>1.5&&d>1.3)put('armchair',cx,cz);
 }else if(['office','study'].includes(room.type)){put('desk',cx,b.minZ+.5);put('chair',cx,b.minZ+1.2,180);put('plant',b.maxX-.4,b.maxZ-.4);}
 return items;
}
export function validateDesign(value:unknown):InteriorDesign|null{
 if(!value||typeof value!=='object')return null;const v=value as InteriorDesign;
 if(!Array.isArray(v.items)||v.items.length>300||!v.finishes||typeof v.finishes!=='object')return null;
 if(v.items.some(i=>!i||typeof i.id!=='string'||typeof i.roomId!=='string'||!catalog.some(c=>c.kind===i.kind)||![i.x,i.z,i.rotation,i.scale].every(Number.isFinite)||i.scale<.5||i.scale>2||!/^#[\da-f]{6}$/i.test(i.color)))return null;
 if(new Set(v.items.map(i=>i.id)).size!==v.items.length)return null;
 if(Object.values(v.finishes).some(f=>!f||typeof f.floor!=='string'||!/^#[\da-f]{6}$/i.test(f.wall)))return null;
 return v;
}
export function getDesignKey(scene:Pick<SceneGraph,'metadata'|'rooms'>){return JSON.stringify([scene.metadata.source_file,scene.rooms.map(r=>[r.id,r.polygon])]);}
