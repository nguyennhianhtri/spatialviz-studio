"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import { UploadPanel } from '@/components/upload-panel';
import { FloorPlanEditor } from '@/components/floor-plan-editor';
import { Header } from '@/components/header';
import { InteriorPanel } from '@/components/interior-panel';
import { useSceneStore } from '@/store/scene-store';
const Viewer3D=dynamic(()=>import('@/components/viewer-3d').then(m=>m.Viewer3D),{ssr:false,loading:()=> <div className="viewer-loading" role="status"><Loader2 className="spin"/>Opening your 3D workspace…</div>});
import { readLocalProject, writeLocalProject } from '@/components/studio/persistence';
export default function Home(){
 const s=useSceneStore();const [saveStatus,setSaveStatus]=useState('Local project');
 useEffect(()=>{
  try{const saved=readLocalProject(localStorage);if(saved){useSceneStore.getState().importProject(saved);setSaveStatus('Restored from this device');}else setSaveStatus('Stored on this device');}
  catch{setSaveStatus('Could not restore local project');}
  let timer:ReturnType<typeof setTimeout>|undefined;let previous=useSceneStore.getState().exportProject();
  const persist=()=>{try{writeLocalProject(localStorage,useSceneStore.getState().exportProject());setSaveStatus('Saved on this device');}catch{setSaveStatus('Local save unavailable — save a copy');}};
  const unsubscribe=useSceneStore.subscribe(state=>{const next=state.exportProject();if(next===previous)return;previous=next;setSaveStatus('Saving on this device…');clearTimeout(timer);timer=setTimeout(persist,500);});
  const flush=()=>{if(timer){clearTimeout(timer);persist();}};window.addEventListener('pagehide',flush);
  return()=>{unsubscribe();clearTimeout(timer);window.removeEventListener('pagehide',flush);};
 },[]);
 return <div className="studio-app"><Header saveStatus={saveStatus}/><div className="project-bar"><div className="project-identity"><span className="eyebrow">PROJECT</span>{s.stage==='upload'?<span className="project-title">A space of your own</span>:<input aria-label="Project name" value={s.projectName} maxLength={80} onChange={e=>s.setProjectName(e.target.value)}/>} {s.sourceKind==='sample'&&s.stage!=='upload'&&<span className="status-pill">Sample project</span>}</div><nav className="stage-nav" aria-label="Project steps">{([{id:'upload',number:'01',label:'Source'},{id:'editor',number:'02',label:'Review plan'},{id:'viewer',number:'03',label:'Explore 3D'}] as const).map((step,i)=><div key={step.id}><button aria-current={s.stage===step.id?'step':undefined} disabled={s.isProcessing||(step.id==='editor'&&!s.extraction&&!s.editorRooms.length)||(step.id==='viewer'&&!s.scene)} onClick={()=>s.setStage(step.id)}><span>{step.number}</span>{step.label}</button>{i<2&&<ChevronRight size={12}/>}</div>)}</nav></div>
 <main id="workspace" className={`studio-main stage-${s.stage}`}>{s.stage==='upload'?<UploadPanel/>:s.stage==='editor'?<FloorPlanEditor/>:<div className="viewer-shell"><div className="viewer-main"><div className="viewer-caption"><div><span className="eyebrow">{s.sourceKind==='sample'?'SAMPLE APARTMENT':'YOUR REVIEWED LAYOUT'}</span><h1>A little closer to home.</h1></div><span className="status-pill">{s.scene?.metadata.total_area_sqm.toFixed(1)} m²</span></div>{s.sceneDirty&&<div role="status" className="stale-notice">This is your previous 3D version. Your floor plan has changed.<button className="text-button" onClick={()=>s.setStage('editor')}>Review & rebuild <ArrowRight size={14}/></button></div>}<div className="viewer-canvas"><Viewer3D/></div></div><InteriorPanel/></div>}</main><footer className="studio-footer"><span>DESIGNED AROUND YOUR SPACE</span><span>Source → review → explore</span><span>SpatialViz Studio</span></footer></div>;
}
