"use client";
import type { EditorRoom, EditorDoor, EditorWindow } from '@/store/scene-store';
import { sampleLayout } from './sample';
export const ROOM_COLORS: Record<string,string> = {living:'#ddcdb6',dining:'#ddcdb6',bedroom:'#e5d8c7',kitchen:'#bfc9ba',bathroom:'#c2cfd0',wc:'#c2cfd0',corridor:'#e3ded3',balcony:'#c6c8b5',yard:'#c6c8b5',storage:'#d1c7bb',office:'#d1c7bb'};
export function PlanDrawing({rooms,doors=[],windows=[],selectedId,onSelect,illustrative=false}: {rooms:EditorRoom[];doors?:EditorDoor[];windows?:EditorWindow[];selectedId?:string|null;onSelect?:(id:string)=>void;illustrative?:boolean}) {
 const minX=Math.min(0,...rooms.map(r=>r.x_mm)), minY=Math.min(0,...rooms.map(r=>r.y_mm));
 const maxX=Math.max(8000,...rooms.map(r=>r.x_mm+r.width_mm)), maxY=Math.max(6000,...rooms.map(r=>r.y_mm+r.height_mm));
 const pad=600;
 return <svg className="plan-svg" viewBox={`${minX-pad} ${minY-pad} ${maxX-minX+pad*2} ${maxY-minY+pad*2}`} aria-label={illustrative?'Illustrative sample apartment floor plan':'Editable room layout'}>
  <defs><pattern id="plan-grid" width="1000" height="1000" patternUnits="userSpaceOnUse"><path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#c9c4b7" strokeWidth="9" opacity=".5"/></pattern></defs>
  <rect x={minX-pad} y={minY-pad} width={maxX-minX+pad*2} height={maxY-minY+pad*2} fill="url(#plan-grid)"/>
  {rooms.map(r=><g key={r.id} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`${r.name}, ${(r.width_mm/1000).toFixed(2)} by ${(r.height_mm/1000).toFixed(2)} metres`} aria-pressed={onSelect?r.id===selectedId:undefined} onClick={()=>onSelect?.(r.id)} onKeyDown={e=>{if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(r.id);}}} style={{cursor:onSelect?'pointer':'default'}}>
   <rect x={r.x_mm} y={r.y_mm} width={r.width_mm} height={r.height_mm} fill={ROOM_COLORS[r.type]||'#e3ded3'} stroke={r.id===selectedId?'#87553e':'#716b60'} strokeWidth={r.id===selectedId?85:42}/>
   {illustrative&&r.type==='bedroom'&&<g fill="#faf7f0" stroke="#b5a58f" strokeWidth="24"><rect x={r.x_mm+350} y={r.y_mm+350} width={Math.min(1700,r.width_mm-700)} height={Math.min(2000,r.height_mm-600)} rx="70"/><path d={`M${r.x_mm+350} ${r.y_mm+1000}h${Math.min(1700,r.width_mm-700)}`}/><rect x={r.x_mm+470} y={r.y_mm+430} width="520" height="340" rx="70"/></g>}
   {illustrative&&r.type==='living'&&<g stroke="#ad9d87" strokeWidth="26"><rect x={r.x_mm+450} y={r.y_mm+900} width="3200" height="2300" rx="100" fill="#e9dfcd"/><rect x={r.x_mm+300} y={r.y_mm+600} width="900" height="2800" rx="130" fill="#f7f2e7"/><rect x={r.x_mm+1700} y={r.y_mm+1500} width="1100" height="1300" rx="420" fill="#ab8865"/><circle cx={r.x_mm+5300} cy={r.y_mm+2300} r="800" fill="#ece6d9"/></g>}
   {!illustrative&&<g pointerEvents="none" textAnchor="middle" fill="#373a32"><text x={r.x_mm+r.width_mm/2} y={r.y_mm+r.height_mm/2-60} fontSize={Math.min(235,r.width_mm/Math.max(r.name.length*.55,4))} fontWeight="600">{r.name}</text><text x={r.x_mm+r.width_mm/2} y={r.y_mm+r.height_mm/2+230} fontSize={Math.min(180,r.width_mm/16)} fill="#625e53">{(r.width_mm/1000).toFixed(2)} × {(r.height_mm/1000).toFixed(2)} m</text></g>}
  </g>)}
  {doors.map(d=><g key={d.id} transform={`translate(${d.x_mm} ${d.y_mm}) rotate(${d.rotation})`}><path d={`M${-d.width_mm/2} 0H${d.width_mm/2}`} stroke="#faf7ef" strokeWidth="80"/><path d={`M${-d.width_mm/2} 0v${-d.width_mm}a${d.width_mm} ${d.width_mm} 0 0 1 ${d.width_mm} ${d.width_mm}`} fill="none" stroke="#8d654a" strokeWidth="22"/></g>)}
  {windows.map(w=><path key={w.id} transform={`translate(${w.x_mm} ${w.y_mm}) rotate(${w.rotation})`} d={`M${-w.width_mm/2} 0H${w.width_mm/2}`} stroke="#789fa0" strokeWidth="85"/>)}
 </svg>;
}
export function SampleDrawing({perspective=false}:{perspective?:boolean}) { const layout=sampleLayout();return <div className={perspective?'sample-perspective':'sample-flat'}><PlanDrawing rooms={layout.editorRooms} doors={layout.editorDoors} windows={layout.editorWindows} illustrative={perspective}/></div>; }
