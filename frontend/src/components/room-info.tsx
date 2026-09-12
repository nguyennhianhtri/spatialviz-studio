"use client";
import type { RoomDef } from '@/types/scene';
import { X } from 'lucide-react';
import { useSceneStore } from '@/store/scene-store';
export function RoomInfo({room}:{room:RoomDef}) {
 const selectRoom=useSceneStore(s=>s.selectRoom);
 return <aside aria-label="Selected room" className="absolute left-5 top-16 z-10 w-56 rounded-xl border border-stone-300/70 bg-[#faf8f2]/95 p-4 text-stone-700 shadow-sm backdrop-blur-md">
   <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{room.label}</h3><p className="mt-1 text-xs capitalize text-stone-500">{room.type.replaceAll('_',' ')}</p></div><button aria-label="Close room details" onClick={()=>selectRoom(null)} className="rounded-md p-1 hover:bg-stone-200"><X size={14}/></button></div>
   <p className="mt-4 text-2xl font-light tracking-tight">{Number(room.area_sqm.toFixed(1))} <span className="text-sm text-stone-500">m²</span></p>
   <p className="mt-1 text-[11px] text-stone-500">Model area · confirm against the plan</p>
 </aside>;
}
