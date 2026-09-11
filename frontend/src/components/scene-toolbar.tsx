"use client";
import { useSceneStore } from '@/store/scene-store';
import { Sun, Moon, Download, Footprints, Box, Scan, Scissors, Armchair, Tags, Maximize } from 'lucide-react';
import type { ReactNode } from 'react';

export function SceneToolbar({onExport,exporting=false,onFit}:{onExport?:()=>void;exporting?:boolean;onFit?:()=>void}) {
 const {viewMode,setViewMode,dayMode,setDayMode,stylePreset='warm',showFurniture=true,cutaway=true,showLabels=true,setAppearance}=useSceneStore();
 return <div role="toolbar" aria-label="Render controls" className="absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl border border-stone-300/80 bg-[#faf8f2]/95 p-1.5 shadow-lg shadow-stone-500/10 backdrop-blur-md" style={{width:'max-content'}}>
   <Tool active={viewMode==='orbit'} onClick={()=>setViewMode('orbit')} icon={<Box/>} label="Dollhouse"/>
   <Tool active={viewMode==='topdown'} onClick={()=>setViewMode('topdown')} icon={<Scan/>} label="Plan"/>
   <Tool active={viewMode==='walkthrough'} onClick={()=>setViewMode('walkthrough')} icon={<Footprints/>} label="Walk"/>
   <Divider/>
   <select aria-label="Material palette" value={stylePreset} onChange={e=>setAppearance({stylePreset:e.target.value as 'warm'|'soft'|'mono'})} className="h-8 rounded-lg border border-stone-300 bg-white/70 px-2 text-xs font-medium text-stone-700 outline-offset-2">
     <option value="warm">Warm oak</option><option value="soft">Soft linen</option><option value="mono">Monochrome</option>
   </select>
   <Tool active={dayMode==='night'} onClick={()=>setDayMode(dayMode==='day'?'night':'day')} icon={dayMode==='day'?<Sun/>:<Moon/>} label={dayMode==='day'?'Daylight':'Evening'}/>
   <Tool active={cutaway} onClick={()=>setAppearance({cutaway:!cutaway})} icon={<Scissors/>} label="Cutaway" disabled={viewMode==='walkthrough'||viewMode==='topdown'}/>
   <Tool active={showFurniture} onClick={()=>setAppearance({showFurniture:!showFurniture})} icon={<Armchair/>} label="Furnish"/>
   <Tool active={showLabels} onClick={()=>setAppearance({showLabels:!showLabels})} icon={<Tags/>} label="Labels"/>
   <Divider/>
   <Tool onClick={onFit||(()=>{})} icon={<Maximize/>} label="Fit" disabled={viewMode==='walkthrough'}/>
   <button type="button" onClick={onExport} disabled={exporting||!onExport} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#444b3d] px-3 text-xs font-medium text-white transition hover:bg-[#343b2d] disabled:opacity-50"><Download size={14}/>{exporting?'Saving…':'Save PNG'}</button>
 </div>;
}
function Divider(){return <span aria-hidden className="mx-0.5 h-5 w-px bg-stone-300"/>;}
function Tool({active,onClick,icon,label,disabled=false}:{active?:boolean;onClick:()=>void;icon:ReactNode;label:string;disabled?:boolean}) {
 return <button type="button" aria-pressed={active} aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-3.5 [&_svg]:w-3.5 ${active?'bg-[#e3e7da] text-[#3f4d34]':'text-stone-600 hover:bg-stone-200/70'}`}>{icon}<span>{label}</span></button>;
}
