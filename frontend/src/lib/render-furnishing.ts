import type { DoorDef, RoomDef, SceneGraph } from '../types/scene';
export type FurnitureKind = 'rug'|'sofa'|'coffee_table'|'bed'|'nightstand'|'dining'|'kitchen'|'vanity'|'toilet'|'shower'|'desk'|'plant'|'bench';
export interface Furnishing { kind:FurnitureKind; x:number; z:number; rotation:number; width:number; depth:number; id?:string }
const sizes:Record<FurnitureKind,[number,number]>={rug:[2.6,1.8],sofa:[2.25,0.96],coffee_table:[1.1,0.65],bed:[1.65,2.18],nightstand:[0.48,0.48],dining:[2.5,2.2],kitchen:[2.4,0.66],vanity:[0.88,0.58],toilet:[0.65,0.8],shower:[0.95,0.95],desk:[1.3,1.15],plant:[0.55,0.55],bench:[1.2,0.5]};
export function pointInRoom(x:number,z:number,polygon:[number,number][]) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z) && x<(xj-xi)*(z-zi)/(zj-zi)+xi) inside=!inside;
  }
  return inside;
}
function extents(item:Furnishing) {
  const c=Math.abs(Math.cos(item.rotation)),s=Math.abs(Math.sin(item.rotation));
  return [(item.width*c+item.depth*s)/2,(item.width*s+item.depth*c)/2];
}
/** Conservative axis-aligned envelope; includes a wall inset and a clear door approach. */
export function footprintFits(item:Furnishing,polygon:[number,number][],doors:DoorDef[]) {
  const [hw,hd]=extents(item),pad=0.16;
  for(let i=0;i<=10;i++) for(let j=0;j<=10;j++) {
    const x=item.x+(i/10*2-1)*(hw+pad),z=item.z+(j/10*2-1)*(hd+pad);
    if(!pointInRoom(x,z,polygon)) return false;
  }
  // A concave vertex inside the envelope signals a narrow notch the sampling could miss.
  if(polygon.some(([x,z])=>Math.abs(x-item.x)<hw+pad && Math.abs(z-item.z)<hd+pad)) return false;
  for(const door of doors) {
    const dx=Math.max(0,Math.abs(door.position[0]-item.x)-hw),dz=Math.max(0,Math.abs(door.position[1]-item.z)-hd);
    if(Math.hypot(dx,dz)<Math.max(0.8,door.width_m*0.8)) return false;
  }
  return true;
}
export function furnishRoom(room:RoomDef,scene:SceneGraph):Furnishing[] {
  if(room.polygon.length<3) return [];
  const minX=Math.min(...room.polygon.map(p=>p[0])),maxX=Math.max(...room.polygon.map(p=>p[0]));
  const minZ=Math.min(...room.polygon.map(p=>p[1])),maxZ=Math.max(...room.polygon.map(p=>p[1]));
  const placed:Furnishing[]=[];
  const doors=scene.doors||[];
  const overlaps=(a:Furnishing,b:Furnishing)=> {const [ax,az]=extents(a),[bx,bz]=extents(b); return Math.abs(a.x-b.x)<ax+bx+0.16 && Math.abs(a.z-b.z)<az+bz+0.16;};
  const explicit=(scene.furniture||[]).filter(f=>pointInRoom(f.position[0],f.position[2],room.polygon));
  if(explicit.length) {
    for(const f of explicit) {
      const aliases:Record<string,FurnitureKind>={dining_table:'dining',table:'dining',kitchen_counter:'kitchen'};
      const kind=(aliases[f.type]||f.type) as FurnitureKind;
      if(!sizes[kind]) continue;
      const [width,depth]=sizes[kind],item={kind,width,depth,x:f.position[0],z:f.position[2],rotation:f.rotation_y,id:f.id};
      if(footprintFits(item,room.polygon,doors) && !placed.some(p=>overlaps(p,item))) placed.push(item);
    }
    return placed;
  }
  const type=room.type.toLowerCase();
  const kinds:FurnitureKind[]=type.includes('bed')?['bed','nightstand','nightstand']:type.includes('living')?['sofa','coffee_table','plant']:type.includes('dining')?['dining','plant']:type.includes('kitchen')?['kitchen']:['bathroom','wc','toilet'].includes(type)?['toilet','vanity','shower']:['office','study'].includes(type)?['desk','plant']:['balcony','yard'].includes(type)?['bench','plant']:[];
  for(const kind of kinds) {
    const [width,depth]=sizes[kind],candidates:Furnishing[]=[];
    for(const rotation of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      const [hw,hd]=extents({kind,width,depth,x:0,z:0,rotation});
      const left=minX+hw+0.18,right=maxX-hw-0.18,top=minZ+hd+0.18,bottom=maxZ-hd-0.18;
      if(left>right || top>bottom) continue;
      for(let i=0;i<=8;i++) for(let j=0;j<=8;j++) {
        const item={kind,width,depth,rotation,x:left+(right-left)*i/8,z:top+(bottom-top)*j/8};
        if(footprintFits(item,room.polygon,doors) && !placed.some(p=>overlaps(p,item))) candidates.push(item);
      }
    }
    const score=(f:Furnishing) => {
      // Seat/headboard/cabinet backs face the closest wall; freestanding pieces stay central.
      if(['coffee_table','dining'].includes(kind)) {
        const sofa=placed.find(p=>p.kind==='sofa');
        const tx=sofa?sofa.x+Math.sin(sofa.rotation)*1.35:(minX+maxX)/2;
        const tz=sofa?sofa.z+Math.cos(sofa.rotation)*1.35:(minZ+maxZ)/2;
        return Math.hypot(f.x-tx,f.z-tz);
      }
      const backX=f.x-Math.sin(f.rotation)*f.depth/2,backZ=f.z-Math.cos(f.rotation)*f.depth/2;
      const wall= f.rotation===0?backZ-minZ:f.rotation===Math.PI/2?backX-minX:f.rotation===Math.PI?maxZ-backZ:maxX-backX;
      const bed=placed.find(p=>p.kind==='bed');
      if(kind==='nightstand' && bed) return Math.hypot(f.x-(bed.x-Math.sin(bed.rotation)*0.8),f.z-(bed.z-Math.cos(bed.rotation)*0.8));
      return wall*4+Math.hypot(f.x-(minX+maxX)/2,f.z-(minZ+maxZ)/2)*0.12;
    };
    candidates.sort((a,b)=>score(a)-score(b));
    if(candidates[0]) placed.push(candidates[0]);
  }
  if(type.includes('living')){const sofa=placed.find(p=>p.kind==='sofa');const rug:Furnishing={kind:'rug',width:2.6,depth:1.8,rotation:sofa?.rotation||0,x:(minX+maxX)/2,z:(minZ+maxZ)/2};if(footprintFits(rug,room.polygon,doors))placed.unshift(rug);}
  return placed;
}
