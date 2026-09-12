"use client";
import { RoundedBox } from '@react-three/drei';
import type { DesignItem } from '../lib/interior-design';
import { fittedKitchenParts } from '../lib/fitted-kitchen';
type V=[number,number,number];
function Box({size,at,color,metal=0,glow=false}:{size:V;at:V;color:string;metal?:number;glow?:boolean}){return <RoundedBox args={size} position={at} radius={Math.min(.012,...size.map(v=>v/4))} smoothness={2} castShadow receiveShadow><meshStandardMaterial color={color} metalness={metal} roughness={metal?.28:.65} emissive={glow?color:'#000000'} emissiveIntensity={glow?.65:0}/></RoundedBox>;}
function Disc({r,depth,at,color,front=false}:{r:number;depth:number;at:V;color:string;front?:boolean}){return <mesh position={at} rotation={front?[Math.PI/2,0,0]:[0,0,0]} castShadow receiveShadow><cylinderGeometry args={[r,r,depth,32]}/><meshStandardMaterial color={color} roughness={.3} metalness={.2}/></mesh>;}
function Washer({y=0}:{y?:number}){return <group position={[0,y,0]}><Box size={[.6,.84,.61]} at={[0,.42,0]} color='#e5e4df'/><Box size={[.56,.11,.012]} at={[0,.75,.311]} color='#d5d5d0'/><Box size={[.19,.042,.008]} at={[-.1,.756,.32]} color='#283532'/><Disc r={.022} depth={.019} at={[.19,.754,.32]} color='#aaaead' front/><Disc r={.225} depth={.025} at={[0,.39,.32]} color='#969f9d' front/><Disc r={.19} depth={.033} at={[0,.39,.335]} color='#26383a' front/><Disc r={.145} depth={.036} at={[0,.39,.34]} color='#4d6060' front/><Box size={[.08,.015,.009]} at={[.17,.395,.357]} color='#c4cbc8'/></group>;}
export function SingaporeFurnishing({item,ceiling=2.7}:{item:DesignItem;ceiling?:number}){
 const c=item.color,h=Math.max(2.2,ceiling),fanY=h-.23;
 switch(item.kind){
 case 'tv-wall':return <group>
  <Box size={[1.8,2.3,.075]} at={[0,1.15,-.16]} color='#e1dace'/>
  {Array.from({length:12},(_,i)=><Box key={i} size={[.025,2.28,.045]} at={[-.85+i*.042,1.15,-.103]} color={c}/>)}
  <Box size={[1.22,1.95,.022]} at={[.26,1.23,-.107]} color='#e7e3dc'/>
  <Box size={[1.8,.28,.4]} at={[0,.32,0]} color={c}/>
  {[-.59,0,.59].map(x=><Box key={x} size={[.565,.245,.018]} at={[x,.322,.205]} color={c}/>)}
  <Box size={[1.55,.015,.015]} at={[0,.172,.16]} color='#ffdfa3' glow/>
  <Box size={[1.16,.665,.043]} at={[.17,1.12,-.056]} color='#202826'/>
  <Box size={[1.11,.615,.008]} at={[.17,1.12,-.029]} color='#364947'/>
  <Box size={[.47,.035,.07]} at={[.17,.755,-.012]} color='#393f3d'/>
 </group>;
 case 'shoe-cabinet':return <group>
  <Box size={[1.1,2.18,.33]} at={[0,1.12,-.015]} color={c}/>
  {[-.272,.272].map(x=><group key={x}><Box size={[.53,.88,.023]} at={[x,.58,.162]} color={c}/><Box size={[.53,.82,.023]} at={[x,1.78,.162]} color='#e4dfd3'/></group>)}
  <Box size={[1.02,.27,.03]} at={[0,1.21,.164]} color='#7a6952'/><Box size={[1.03,.025,.11]} at={[0,1.065,.11]} color='#c4a783'/><Box size={[1,.012,.014]} at={[0,1.335,.176]} color='#ffe0ac' glow/>
  <Box size={[.22,.025,.1]} at={[-.22,1.091,.1]} color='#ded5c3'/><Box size={[1,.08,.02]} at={[0,.09,.15]} color='#595448'/>
 </group>;
 case 'sg-kitchen':return <group>
  {fittedKitchenParts(c).map(({id,...part})=><Box key={id} {...part}/>)}
  <Box size={[.63,.012,.44]} at={[-.63,.887,.02]} color='#242d2d'/>
  {[-.78,-.47].map(x=><Disc key={x} r={.1} depth={.005} at={[x,.898,.02]} color='#596562'/>)}
  <Box size={[.65,.05,.4]} at={[-.63,1.48,-.08]} color='#626962' metal={.6}/>
  <Disc r={.026} depth={.004} at={[.65,.719,.01]} color='#4c5954'/>
  <Box size={[.025,.27,.025]} at={[.66,1.04,-.22]} color='#a5b5b0' metal={.8}/><Box size={[.025,.025,.17]} at={[.66,1.16,-.145]} color='#a5b5b0' metal={.8}/>
  <Disc r={.105} depth={.14} at={[.1,.98,.06]} color='#ebe6dc'/><Disc r={.108} depth={.02} at={[.1,1.06,.06]} color='#656f66'/>
 </group>;
 case 'washer':return <Washer/>;
 case 'laundry-tower':return <group><Box size={[.7,1.95,.69]} at={[0,.975,0]} color={c}/><group position={[0,.045,.03]}><Washer/><Washer y={.875}/></group><Box size={[.7,.06,.7]} at={[0,1.95,0]} color={c}/></group>;
 case 'drying-rack':return <group position={[0,h-.42,0]}>
  {[-.69,.69].map(x=><group key={x}><Box size={[.025,.4,.025]} at={[x,.2,0]} color='#b8bfbb' metal={.7}/><Box size={[.06,.06,.73]} at={[x,0,0]} color={c}/></group>)}
  {[-.3,-.15,0,.15,.3].map(z=><Box key={z} size={[1.6,.02,.02]} at={[0,0,z]} color='#aab6b1' metal={.6}/>)}
  <Box size={[.38,.45,.012]} at={[-.24,-.23,-.15]} color='#d5ddd3'/><Box size={[.34,.35,.012]} at={[.25,-.18,.15]} color='#d8c7ad'/>
 </group>;
 case 'aircon':return <group position={[0,h-.42,0]}>
  <Box size={[.91,.27,.235]} at={[0,0,0]} color={c}/><Box size={[.78,.045,.008]} at={[0,-.075,.12]} color='#66716b'/>
  {[-.006,.008,.022].map(y=><Box key={y} size={[.75,.006,.01]} at={[0,-.08+y,.126]} color='#adb7ad'/>)}
  <Box size={[.013,.013,.008]} at={[.33,-.021,.121]} color='#b2d6ad' glow/>
 </group>;
 case 'ceiling-fan':return <group position={[0,fanY,0]}>
  <Disc r={.095} depth={.07} at={[0,.2,0]} color={c}/><Disc r={.022} depth={.18} at={[0,.08,0]} color={c}/><Disc r={.13} depth={.08} at={[0,-.025,0]} color={c}/>
  {[0,1,2].map(i=><group key={i} rotation={[0,i*Math.PI*2/3,0]}><Box size={[.49,.022,.13]} at={[.34,0,.022]} color={c}/></group>)}
  <Disc r={.09} depth={.027} at={[0,-.078,0]} color='#fff0d4'/>
 </group>;
 default:return null;
 }
}
