"use client";
import { RoundedBox } from '@react-three/drei';
import type { Furnishing } from '@/lib/render-furnishing';
import type { RenderPalette } from '@/lib/render-palette';

type V3=[number,number,number];
function Block({at=[0,0,0],size,color,radius=0.02}:{at?:V3;size:V3;color:string;radius?:number}) {
  return <RoundedBox args={size} radius={Math.min(radius,...size.map(s=>s/3))} smoothness={2} position={at} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.82}/></RoundedBox>;
}
function Round({at,size,color}:{at:V3;size:V3;color:string}) {
  return <mesh position={at} scale={size} castShadow receiveShadow><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color={color} roughness={0.88}/></mesh>;
}
function Cylinder({at,radius,height,color}:{at:V3;radius:number;height:number;color:string}) {
  return <mesh position={at} castShadow receiveShadow><cylinderGeometry args={[radius,radius*0.95,height,24]}/><meshStandardMaterial color={color} roughness={0.6}/></mesh>;
}
function Legs({width,depth,height,color}:{width:number;depth:number;height:number;color:string}) {
  return <>{[-1,1].flatMap(x=>[-1,1].map(z=><Block key={`${x},${z}`} at={[x*(width/2-0.08),height/2,z*(depth/2-0.08)]} size={[0.055,height,0.055]} color={color}/>))}</>;
}
function Chair({x,z,rotation=0,p}:{x:number;z:number;rotation?:number;p:RenderPalette}) {
  return <group position={[x,0,z]} rotation={[0,rotation,0]}><Legs width={0.42} depth={0.42} height={0.43} color={p.wood}/><Block at={[0,0.46,0]} size={[0.47,0.09,0.47]} color={p.fabric} radius={0.045}/><Block at={[0,0.7,-0.2]} size={[0.46,0.4,0.08]} color={p.wood} radius={0.04}/></group>;
}
function Lamp({x,z,p}:{x:number;z:number;p:RenderPalette}) {
  return <group position={[x,0,z]}><Cylinder at={[0,0.06,0]} radius={0.1} height={0.05} color={p.metal}/><Cylinder at={[0,0.18,0]} radius={0.022} height={0.24} color={p.metal}/><mesh position={[0,0.34,0]} castShadow><cylinderGeometry args={[0.11,0.16,0.22,24]}/><meshStandardMaterial color="#f2e4cd" roughness={0.95} emissive="#e9bd73" emissiveIntensity={0.13}/></mesh></group>;
}
/** Deliberately procedural furnishings, not fetched models or generated photographs. */
export function FurnitureObject({item,palette:p}:{item:Furnishing;palette:RenderPalette}) {
 let object;
 switch(item.kind) {
  case 'sofa': object=<><Legs width={2.14} depth={0.85} height={0.16} color={p.wood}/><Block at={[0,0.27,0]} size={[2.2,0.3,0.9]} color={p.fabric} radius={0.09}/><Block at={[0,0.65,-0.35]} size={[2.15,0.58,0.2]} color={p.fabric} radius={0.075}/>{[-1,1].map(s=><group key={s}><Block at={[s*1.025,0.49,0]} size={[0.2,0.45,0.94]} color={p.fabric} radius={0.07}/><Block at={[s*0.49,0.47,0.06]} size={[0.9,0.15,0.67]} color={p.fabric} radius={0.055}/><group rotation={[0,0,s*0.12]} position={[s*0.69,0.71,-0.2]}><Block size={[0.36,0.34,0.13]} color={s>0?p.accent:p.rug} radius={0.055}/></group></group>)}</>;break;
  case 'bed': object=<><Legs width={1.55} depth={2.05} height={0.17} color={p.metal}/><Block at={[0,0.22,0]} size={[1.65,0.25,2.16]} color={p.wood} radius={0.035}/><Block at={[0,0.43,0.02]} size={[1.59,0.28,2.03]} color="#f5f1e8" radius={0.08}/><Block at={[0,0.71,-1.025]} size={[1.65,1.05,0.12]} color={p.fabric} radius={0.035}/><Block at={[0,0.58,0.29]} size={[1.6,0.12,1.42]} color={p.fabric} radius={0.055}/><Block at={[0,0.66,0.65]} size={[1.61,0.06,0.57]} color={p.accent} radius={0.025}/>{[-1,1].map(s=><Block key={s} at={[s*0.39,0.62,-0.67]} size={[0.64,0.15,0.44]} color="#faf7f0" radius={0.07}/>)}</>;break;
  case 'nightstand':object=<><Block at={[0,0.26,0]} size={[0.46,0.48,0.46]} color={p.wood}/><Block at={[0,0.3,0.233]} size={[0.38,0.006,0.01]} color={p.metal}/><group position={[0,0.5,0]}><Lamp x={0} z={0} p={p}/></group></>;break;
  case 'coffee_table':object=<><Legs width={0.97} depth={0.55} height={0.32} color={p.wood}/><Block at={[0,0.35,0]} size={[1.1,0.07,0.65]} color={p.wood} radius={0.12}/><Block at={[0.12,0.4,0.05]} size={[0.25,0.025,0.2]} color={p.accent}/><Cylinder at={[-0.25,0.43,0]} radius={0.065} height={0.09} color="#f2eee5"/></>;break;
  case 'dining': object=<><Legs width={1.5} depth={0.82} height={0.74} color={p.wood}/><Block at={[0,0.77,0]} size={[1.65,0.08,0.9]} color={p.wood} radius={0.11}/>{[-1,1].flatMap(s=>[-1,1].map(x=><Chair key={`${s},${x}`} x={x*0.48} z={s*0.85} rotation={s>0?Math.PI:0} p={p}/>))}<Cylinder at={[0,0.87,0]} radius={0.09} height={0.15} color={p.stone}/><Round at={[0,1.02,0]} size={[0.14,0.14,0.14]} color={p.accent}/></>;break;
  case 'kitchen':object=<><Block at={[0,0.1,0]} size={[2.3,0.2,0.55]} color={p.metal}/>{[-0.8,0,0.8].map(x=><group key={x}><Block at={[x,0.48,0]} size={[0.785,0.74,0.62]} color={p.fabric}/><Block at={[x,0.7,0.32]} size={[0.22,0.018,0.018]} color={p.metal}/></group>)}<Block at={[0,0.88,0]} size={[2.4,0.055,0.66]} color={p.stone}/><Block at={[-0.72,0.914,0]} size={[0.52,0.009,0.46]} color={p.metal}/>{[-1,1].flatMap(x=>[-1,1].map(z=><Cylinder key={`${x},${z}`} at={[-0.72+x*0.13,0.924,z*0.115]} radius={0.075} height={0.008} color="#1e2420"/>))}<Block at={[0.68,0.915,0]} size={[0.48,0.01,0.38]} color="#929993"/><Block at={[0.68,0.924,0]} size={[0.39,0.012,0.3]} color="#68756e"/><Cylinder at={[0.68,1.04,-0.23]} radius={0.018} height={0.25} color={p.metal}/><Block at={[0.68,1.16,-0.17]} size={[0.025,0.025,0.15]} color={p.metal}/></>;break;
  case 'vanity':object=<><Block at={[0,0.47,0]} size={[0.87,0.67,0.55]} color={p.wood}/><Block at={[0,0.84,0]} size={[0.88,0.07,0.58]} color={p.stone}/><Round at={[0,0.9,0]} size={[0.28,0.09,0.2]} color="#fafaf4"/><Round at={[0,0.945,0]} size={[0.21,0.024,0.14]} color="#bec8c2"/><Cylinder at={[0,1,-0.22]} radius={0.017} height={0.23} color={p.metal}/></>;break;
  case 'toilet':object=<><Block at={[0,0.49,-0.26]} size={[0.42,0.73,0.22]} color="#f6f6ef" radius={0.055}/><Round at={[0,0.23,0.02]} size={[0.23,0.24,0.29]} color="#f4f4ed"/><Round at={[0,0.45,0.04]} size={[0.28,0.06,0.34]} color="#fbfbf7"/><Round at={[0,0.49,0.04]} size={[0.17,0.015,0.23]} color="#c9d2cd"/></>;break;
  case 'shower':object=<><Block at={[0,0.06,0]} size={[0.94,0.1,0.94]} color={p.stone}/><mesh position={[0.44,1.04,0]}><boxGeometry args={[0.018,1.9,0.92]}/><meshStandardMaterial color="#b8d5cf" transparent opacity={0.18} roughness={0.2} depthWrite={false}/></mesh><Cylinder at={[-0.25,1.3,-0.42]} radius={0.016} height={1.3} color={p.metal}/><Cylinder at={[-0.25,1.95,-0.3]} radius={0.13} height={0.025} color={p.metal}/></>;break;
  case 'desk':object=<><Legs width={1.22} depth={0.5} height={0.73} color={p.wood}/><Block at={[0,0.76,-0.22]} size={[1.3,0.055,0.62]} color={p.wood}/><Block at={[0,1.05,-0.4]} size={[0.57,0.36,0.035]} color={p.metal}/><Block at={[0,0.81,-0.2]} size={[0.48,0.025,0.18]} color={p.stone}/><Chair x={0} z={0.31} rotation={Math.PI} p={p}/></>;break;
  case 'bench':object=<><Legs width={1.1} depth={0.44} height={0.45} color={p.metal}/><Block at={[0,0.48,0]} size={[1.2,0.09,0.5]} color={p.wood}/></>;break;
  case 'plant':object=<><mesh position={[0,0.2,0]} castShadow><cylinderGeometry args={[0.18,0.13,0.38,20]}/><meshStandardMaterial color={p.stone} roughness={0.95}/></mesh><Cylinder at={[0,0.43,0]} radius={0.017} height={0.5} color="#786c4d"/>{[0,1,2,3,4,5].map(i=><group key={i} rotation={[0,i*2.4,0]}><mesh position={[0.11,0.49+i*0.06,0]} rotation={[0,0,-0.6+i*0.17]} scale={[0.14,0.24,0.065]} castShadow><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color={i%2?'#748d65':'#8f9f78'} roughness={0.86}/></mesh></group>)}</>;break;
 }
 return <group position={[item.x,0.02,item.z]} rotation={[0,item.rotation,0]}>{object}</group>;
}
