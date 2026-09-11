"use client";
import { useEffect, useRef, useState, useMemo } from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import { playerPositionRef,playerYawRef } from './first-person-controls';
import { sceneBounds } from '@/lib/render-layout';
import { pointInRoom } from '@/lib/render-furnishing';
import type { SceneGraph } from '@/types/scene';
export function Minimap({scene}:{scene:SceneGraph}) {
 const dot=useRef<SVGGElement>(null),[open,setOpen]=useState(true),[roomName,setRoomName]=useState('Outside');
 const b=useMemo(()=>sceneBounds(scene),[scene]);
 const scale=164/Math.max(b.width,b.depth,1);
 const project=(x:number,z:number)=>[98+(x-b.center[0])*scale,98+(z-b.center[2])*scale];
 useEffect(()=>{
   let frame=0,last=0;
   const update=(time:number)=>{
     const {x,z}=playerPositionRef.current;
     const px=98+(x-b.center[0])*scale,pz=98+(z-b.center[2])*scale;
     dot.current?.setAttribute('transform',`translate(${px} ${pz}) rotate(${180-playerYawRef.current*180/Math.PI})`);
     if(time-last>300){setRoomName(scene.rooms.find(r=>pointInRoom(x,z,r.polygon))?.label||'Outside');last=time;}
     frame=requestAnimationFrame(update);
   };
   frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
 },[scene,b,scale]);
 if(!open) return <button onClick={()=>setOpen(true)} className="absolute right-4 top-4 rounded-lg border border-stone-300 bg-white/90 p-2 text-stone-600" aria-label="Show floor map"><MapIcon size={16}/></button>;
 return <aside className="absolute right-4 top-4 overflow-hidden rounded-xl border border-stone-300/80 bg-[#faf8f2]/95 text-stone-600 shadow-sm backdrop-blur-md">
   <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-wider">Floor map</span><button aria-label="Hide floor map" onClick={()=>setOpen(false)}><X size={13}/></button></div>
   <svg aria-label="Your position in the floor plan" width={196} height={196} viewBox="0 0 196 196">
     {scene.rooms.map(r=><polygon key={r.id} points={r.polygon.map(([x,z])=>project(x,z).join(',')).join(' ')} fill={r.label===roomName?'#ccd3bd':'#e6ddce'} stroke="#a79e90" strokeWidth={1}/>)}
     {scene.doors.map(d=>{const [x,y]=project(...d.position);return <circle key={d.id} cx={x} cy={y} r={2} fill="#faf8f2" stroke="#8e806d" strokeWidth={0.7}/>;})}
     <g ref={dot}><circle r={9} fill="#687552" opacity={0.16}/><path d="M 0 -7 L 4 5 L 0 3 L -4 5 Z" fill="#50613d" stroke="#fffdf7" strokeWidth={1}/></g>
   </svg>
   <p className="border-t border-stone-200 px-3 py-2 text-[11px]">{roomName}</p>
 </aside>;
}
