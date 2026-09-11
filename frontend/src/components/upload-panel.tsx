"use client";
import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpRight, Upload, FileImage, Loader2, ArrowRight, RotateCcw, X } from 'lucide-react';
import { useSceneStore, type ExtractionResult } from '@/store/scene-store';
import { MAX_FILE_BYTES, validateFloorPlanFile } from './studio/project';
import { requestJson } from './studio/requests';
import { SampleDrawing } from './studio/plan-drawing';
export function UploadPanel() {
 const store=useSceneStore(); const [file,setFile]=useState<File|null>(null); const [error,setError]=useState(''); const [cancelled,setCancelled]=useState(false); const [dimensionUnit,setDimensionUnit]=useState('mm');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();},[]);
 async function upload(next:File) {
  const problem=validateFloorPlanFile(next); if(problem){setError(problem);return;}
  request.current?.abort(); const controller=new AbortController(); request.current=controller;
  setFile(next);setError('');setCancelled(false);store.setProcessing(true,'Reading your floor plan');
  const body=new FormData();body.append('file',next);body.append('dimension_unit',dimensionUnit);
  const timeout=setTimeout(()=>controller.abort('timeout'),300000);
  try {
   const started=await requestJson<{id:string}>('/api/extraction-jobs',{method:'POST',body,signal:controller.signal});
   let data:ExtractionResult|null=null;
   while(!controller.signal.aborted){
    const job=await requestJson<{status:string;result?:ExtractionResult;error?:string}>(`/api/extraction-jobs/${encodeURIComponent(started.id)}`,{signal:controller.signal});
    if(job.status==='failed')throw new Error(job.error||'Could not read this plan. Your previous project is unchanged.');
    if(job.status==='complete'){data=job.result||null;break;}
    await new Promise(resolve=>setTimeout(resolve,1000));
   }
   if(controller.signal.aborted) return;
   if(!data || !Array.isArray(data.dimensions) || !Array.isArray(data.room_labels)) throw new Error('The service returned an unreadable layout. Please retry or choose a clearer plan.');
   store.setExtraction(data);store.setProjectName(next.name.replace(/\.[^.]+$/,''));
  } catch(e) {
   if(controller.signal.aborted){if(controller.signal.reason==='timeout')setError('Reading this plan timed out. Your file is still selected; try again.');}
   else setError(e instanceof Error?e.message:'Could not read this plan. Your previous work is unchanged.');
  } finally {clearTimeout(timeout);if(request.current===controller){request.current=null;useSceneStore.getState().setProcessing(false);}}
 }
 function cancel(){request.current?.abort();request.current=null;store.setProcessing(false);setCancelled(true);}
 const {getRootProps,getInputProps,isDragActive}=useDropzone({accept:{'image/png':['.png'],'image/jpeg':['.jpg','.jpeg']},maxFiles:1,maxSize:MAX_FILE_BYTES,disabled:store.isProcessing,onDrop:accepted=>{if(accepted[0])void upload(accepted[0]);},onDropRejected:rejections=>{const code=rejections[0]?.errors[0]?.code;setError(code==='file-too-large'?'Choose a file smaller than 20 MB.':code==='too-many-files'?'Drop one floor plan at a time.':'Use a PNG or JPG floor plan.');}});
 return <div className="upload-workspace">
  <section className="command-panel">
   <div className="eyebrow">YOUR DESIGN DESK</div><h1>A new perspective<br/>on your space.</h1><p className="intro-copy">Start with a floor plan.<br/>Make it a place you can explore.</p>
   <div {...getRootProps()} className={`upload-drop ${isDragActive?'drag-active':''} ${store.isProcessing?'is-busy':''}`} role="button" aria-label="Upload a floor plan" aria-disabled={store.isProcessing}>
    <input {...getInputProps()} aria-label="Choose floor plan file"/>
    <Upload size={22} strokeWidth={1.4}/><strong>{isDragActive?'Drop your plan here':'Choose a floor plan'}</strong><span>or drag it onto this panel</span><small>PNG or JPG · up to 20 MB</small>
   </div>
   <label className="field-label" style={{width:"100%",marginTop:16}}>Dimensions on your plan<select aria-label="Plan dimension units" disabled={store.isProcessing} value={dimensionUnit} onChange={e=>setDimensionUnit(e.target.value)}><option value="mm">Millimetres · common HDB plans</option><option value="cm">Centimetres</option><option value="m">Metres</option><option value="ft">Feet</option><option value="auto">Read units from the image</option></select></label>
   {file&&<div className="selected-file"><FileImage size={18}/><span title={file.name}>{file.name}</span></div>}
   {store.isProcessing&&<div className="waiting-state" role="status"><Loader2 size={18} className="spin"/><div><strong>Reading your floor plan</strong><p>Waiting for the layout service. Complex plans may take a few minutes.</p><button className="text-button" onClick={cancel}><X size={14}/> Cancel request</button></div></div>}
   {error&&<div className="inline-error" role="alert"><strong>We couldn’t continue</strong><p>{error}</p>{file&&!store.isProcessing&&<button className="text-button" onClick={()=>void upload(file)}><RotateCcw size={14}/> Retry this file</button>}</div>}
   {cancelled&&!error&&<div className="inline-notice" role="status">Stopped waiting. Your file and previous work are unchanged; the server may finish this reading in the background.<button className="text-button" onClick={()=>file&&void upload(file)}>Try again <ArrowRight size={14}/></button></div>}
   <div className="command-note"><span className="eyebrow">A LITTLE PREPARATION</span><p>A straight, clear plan with visible room dimensions works best. You’ll review the layout before creating your 3D space.</p></div>
   {(store.scene||store.editorRooms.length>0)&&<button disabled={store.isProcessing} className="secondary-button" onClick={()=>store.setStage(store.scene&&!store.sceneDirty?'viewer':'editor')}>Return to current project <ArrowRight size={15}/></button>}
  </section>
  <section className="sample-workspace" aria-label="Sample project preview">
   <div className="workspace-caption"><span className="eyebrow">THE POSSIBILITIES, IN PLAN</span><span className="status-pill">Illustrative sample</span></div>
   <div className="sample-art"><div className="drawing-cross top-left"/><div className="drawing-cross bottom-right"/><SampleDrawing perspective/><span className="drawing-annotation">SPACE / LIGHT / POSSIBILITY</span></div>
   <div className="sample-caption"><div><div className="eyebrow">EXPLORE A FINISHED EXAMPLE</div><h2>The courtyard apartment</h2><p>Warm materials. Open living. Room to imagine.</p></div><button className="primary-button" disabled={store.isProcessing} onClick={()=>store.loadSample()}>Open sample <ArrowUpRight size={17}/></button></div>
   <div className="sample-footnote">Sample project · works without the layout service · not an uploaded result</div>
  </section>
 </div>;
}
