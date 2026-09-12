"use client";
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import toast from 'react-hot-toast';
import { useSceneStore } from '@/store/scene-store';
import { SceneToolbar } from './scene-toolbar';
import { RoomInfo } from './room-info';
import { RoomFloor, DerivedWall, DerivedDoor, DerivedWindow, RoomFurniture, roomAnchor } from './scene-derived';
import { deriveSceneGeometry, wallSolidSegments } from '@/lib/geometry-engine';
import { sceneBounds, fitCamera, roomPresentation, type RenderBounds, type RoomPresentation } from '@/lib/render-layout';
import { renderPalettes } from '@/lib/render-palette';
import { FirstPersonControls, PlayerPositionTracker, collisionDataRef, walkLookRef } from './first-person-controls';
import { Minimap } from './minimap';
import { EditableFurnishings } from './editable-furnishings';
import { useDesignStore } from '@/store/design-store';
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { SceneGraph } from '@/types/scene';

type ExportRender=()=>Promise<Blob>;
function RenderCapture({register}:{register:(capture:ExportRender|null)=>void}) {
 const {gl,scene,camera}=useThree();
 useEffect(()=>{
   register(async()=>{
     if(gl.getContext().isContextLost()) throw new Error('The 3D canvas needs to reload before exporting.');
     // Re-render the actual scene synchronously before reading its WebGL drawing buffer.
     await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
     return new Promise<Blob>((resolve,reject)=>gl.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('The browser could not save this render.')),'image/png'));
   });
   return ()=>register(null);
 },[gl,scene,camera,register]);
 return null;
}
function ArchitecturalScene({scene,bounds:b,focus}:{scene:SceneGraph;bounds:RenderBounds;focus:RoomPresentation|null}) {
 const {selectedRoom,selectRoom,dayMode,stylePreset='warm',showFurniture=true,showLabels=true,cutaway=true,viewMode}=useSceneStore();
 const derived=useMemo(()=>deriveSceneGeometry(scene),[scene]);
 const palette=renderPalettes[stylePreset],evening=dayMode==='night';
 const roomFinishes=useDesignStore(s=>s.finishes);
 const center:[number,number]=focus?[focus.bounds.center[0],focus.bounds.center[2]]:[b.center[0],b.center[2]];
 const cutProps={cutaway:cutaway&&viewMode!=='walkthrough',center,topdown:viewMode==='topdown',stylePreset,roomPresentation:!!focus};
 const visibleRoom=(id:string)=>!focus||focus.roomIds.includes(id);
 const visibleEdge=(edge:{rooms:string[]})=>!focus||edge.rooms.some(visibleRoom);
 const lightTarget=useMemo(()=>{const target=new THREE.Object3D();target.position.set(b.center[0],0,b.center[2]);return target;},[b]);
 useEffect(()=>{
   // Collide with actual solids at walking height, so nearby perpendicular walls never become doorways.
   const walls=derived.edges.flatMap(edge=>wallSolidSegments(edge,derived.doors,[]).filter(s=>s.y-s.h/2<1.6&&s.y+s.h/2>1.6).map(s=>{
     const ux=Math.cos(edge.angle),uz=Math.sin(edge.angle);
     return {ax:edge.midpoint.x+(s.x-s.w/2)*ux,az:edge.midpoint.y+(s.x-s.w/2)*uz,bx:edge.midpoint.x+(s.x+s.w/2)*ux,bz:edge.midpoint.y+(s.x+s.w/2)*uz,thickness:edge.thickness};
   }));
   collisionDataRef.current={walls,doors:[]};
   return ()=>{collisionDataRef.current={walls:[],doors:[]};};
 },[derived]);
 return <>
   <color attach="background" args={[evening?'#ded7ce':palette.background]}/>
   <ambientLight intensity={evening?0.48:0.65} color={evening?'#e8c89d':'#fff9ed'}/>
   <hemisphereLight args={[evening?'#d1d8e6':'#fffdf7',palette.ground,evening?0.8:1.35]}/>
   <primitive object={lightTarget}/>
   <directionalLight target={lightTarget} position={[b.center[0]-b.span*0.55,b.height+b.span*1.3,b.center[2]-b.span*0.5]} color={evening?'#ffc98c':'#fff3d9'} intensity={evening?2.3:3.2} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-b.span} shadow-camera-right={b.span} shadow-camera-top={b.span} shadow-camera-bottom={-b.span} shadow-camera-near={0.1} shadow-camera-far={b.span*5+20} shadow-bias={-0.00015} shadow-normalBias={0.025} shadow-radius={3}/>
   <directionalLight position={[b.center[0]+b.span,b.span,b.center[2]+b.span]} intensity={evening?0.45:0.7} color="#e5edf2"/>
   {evening&&scene.rooms.slice(0,16).map(room=>{const [x,z]=roomAnchor(room);return <pointLight key={room.id} position={[x,b.height*0.78,z]} color="#ffca86" intensity={9} distance={Math.max(4,Math.sqrt(room.area_sqm)*1.4)} decay={2}/>;})}
   <mesh rotation={[-Math.PI/2,0,0]} position={[b.center[0],-0.2,b.center[2]]} receiveShadow><planeGeometry args={[b.span*200,b.span*200]}/><meshStandardMaterial color={evening?'#d4c9bc':palette.ground} roughness={1}/></mesh>
   <ContactShadows key={`${scene.metadata.source_file}-${stylePreset}-${dayMode}-${focus?.roomIds.join(',')||'home'}`} position={[b.center[0],-0.185,b.center[2]]} opacity={0.32} scale={b.span+3} blur={2.3} far={3} resolution={512} frames={1} color="#645644"/>
   {scene.rooms.filter(room=>visibleRoom(room.id)).map(room=><RoomFloor key={room.id} room={room} isSelected={selectedRoom===room.id} onSelect={()=>selectRoom(selectedRoom===room.id?null:room.id)} stylePreset={stylePreset} showLabels={showLabels&&viewMode!=='walkthrough'}/>)}
   {derived.edges.filter(visibleEdge).map(edge=><DerivedWall key={`${edge.start.x},${edge.start.y}:${edge.end.x},${edge.end.y}`} edge={edge} allDoorPlacements={derived.doors} allWindowPlacements={derived.windows} wallColor={edge.rooms.filter(visibleRoom).map(id=>roomFinishes[id]?.wall).find(Boolean)} {...cutProps}/>)}
   {derived.doors.filter(placement=>visibleEdge(placement.edge)).map(placement=><DerivedDoor key={placement.door.id} placement={placement} {...cutProps}/>)}
   {derived.windows.filter(placement=>visibleEdge(placement.edge)).map(placement=><DerivedWindow key={placement.window.id} placement={placement} {...cutProps}/>)}
   {showFurniture&&<EditableFurnishings scene={scene} visibleRoomIds={focus?.roomIds}/>}
 </>;
}
function FittedControls({bounds,fitRevision,direction}:{bounds:RenderBounds;fitRevision:number;direction?:[number,number,number]}) {
 const viewMode=useSceneStore(s=>s.viewMode),{camera,size}=useThree();
 const controls=useRef<OrbitControlsImpl>(null);
 const fit=useMemo(()=>fitCamera(bounds,size.width/Math.max(1,size.height),42,viewMode,direction),[bounds,size.width,size.height,viewMode,direction]);
 useEffect(()=>{
   camera.position.fromArray(fit.position);camera.lookAt(...bounds.center);
   camera.near=0.02;camera.far=Math.max(500,fit.distance*10);camera.updateProjectionMatrix();
   if(controls.current){controls.current.target.fromArray(bounds.center);controls.current.update();}
 },[camera,bounds,fit,fitRevision]);
 return <OrbitControls ref={controls} makeDefault target={bounds.center} enableDamping dampingFactor={0.08} minDistance={1} maxDistance={fit.distance*4} minPolarAngle={0} maxPolarAngle={viewMode==='topdown'?0.001:Math.PI*0.485} enableRotate={viewMode!=='topdown'}/>;
}
function WalkEntry({scene}:{scene:SceneGraph}) {
 const {camera}=useThree();
 useEffect(()=>{
   const room=scene.rooms.find(r=>r.type==='living')||scene.rooms[0];
   if(!room) return;
   const [x,z]=roomAnchor(room);
   camera.position.set(x,1.6,z);camera.lookAt(x,1.6,z-1);
   walkLookRef.current={yaw:0,pitch:0,set:true};
 },[scene,camera]);
 return null;
}
export function Viewer3D() {
 const {scene:sourceScene,viewMode,selectedRoom}=useSceneStore();
 const finishes=useDesignStore(s=>s.finishes);
 const scene=useMemo(()=>sourceScene?{...sourceScene,rooms:sourceScene.rooms.map(r=>finishes[r.id]?{...r,floor_material:finishes[r.id].floor,wall_color:finishes[r.id].wall}:r)}:null,[sourceScene,finishes]);
 const [fitRevision,setFitRevision]=useState(0),[exporting,setExporting]=useState(false),[focus,setFocus]=useState<RoomPresentation|null>(null);
 useEffect(()=>{
   setFocus(null);
   const onFocus=(event:Event)=>{if(sourceScene)setFocus(roomPresentation(sourceScene,(event as CustomEvent<string>).detail,useDesignStore.getState().items));};
   window.addEventListener('spatialviz:focus-room',onFocus);
   return()=>window.removeEventListener('spatialviz:focus-room',onFocus);
 },[sourceScene]);
 // Changing the design-room selector must not leave edits hidden in a different room.
 useEffect(()=>{if(selectedRoom)setFocus(current=>current&&!current.roomIds.includes(selectedRoom)?null:current);},[selectedRoom]);
 const capture=useRef<ExportRender|null>(null);
 const register=useCallback((fn:ExportRender|null)=>{capture.current=fn;},[]);
 const bounds=useMemo(()=>sourceScene?sceneBounds(sourceScene):null,[sourceScene]);
 const activeFocus=viewMode==='walkthrough'?null:focus;
 const exportPNG=async()=>{
   if(!capture.current || exporting) return;
   setExporting(true);
   try {
     const blob=await capture.current();const url=URL.createObjectURL(blob);const link=document.createElement('a');
     link.href=url;link.download=`floorplan-${viewMode}-${Date.now()}.png`;document.body.appendChild(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(url),10000);toast.success('PNG render saved');
   } catch(error){toast.error(error instanceof Error?error.message:'Could not export this render.');}
   finally {setExporting(false);}
 };
 if(!scene||!bounds) return null;
 const walk=viewMode==='walkthrough',selected=scene.rooms.find(r=>r.id===selectedRoom);
 return <div className="relative h-full w-full overflow-hidden" data-testid="studio-render">
   <Canvas shadows dpr={[1,2]} gl={{antialias:true,preserveDrawingBuffer:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1}} onCreated={({gl})=>{gl.shadowMap.type=THREE.PCFSoftShadowMap;gl.outputColorSpace=THREE.SRGBColorSpace;}}>
     <PerspectiveCamera makeDefault position={fitCamera(bounds,1.5,42,'orbit').position} fov={walk?68:42} near={0.02} far={Math.max(500,bounds.span*20)}/>
     <ArchitecturalScene scene={scene} bounds={bounds} focus={activeFocus}/>
     <PlayerPositionTracker/>
     {walk?<><WalkEntry scene={scene}/><FirstPersonControls/></>:<FittedControls bounds={activeFocus?.bounds||bounds} direction={activeFocus?.direction} fitRevision={fitRevision}/>}
     <EffectComposer multisampling={4}><N8AO aoRadius={0.6} intensity={1.6} distanceFalloff={1} quality="medium" color="#645b4a"/><ToneMapping mode={ToneMappingMode.ACES_FILMIC}/></EffectComposer>
     <RenderCapture register={register}/>
   </Canvas>
   <div className="absolute left-5 top-4 rounded-2xl bg-white/90 px-3 py-2 text-[10px] font-medium text-stone-600 backdrop-blur-sm">
     <div className="tracking-[0.14em]">{walk?'WALKTHROUGH':activeFocus?`${activeFocus.label} · ROOM VIEW`:'ARCHITECTURAL MODEL'}</div>
     {activeFocus&&<><div className="mt-1">Other rooms hidden · ceiling omitted</div><button className="mt-2 underline underline-offset-2" onClick={()=>setFocus(null)}>Show whole home</button></>}
   </div>
   {walk&&<><div className="absolute top-14 left-5 rounded-lg bg-white/90 px-3 py-2 text-xs text-stone-700">WASD to move · drag to look · E for doors</div><Minimap scene={scene}/></>}
   <SceneToolbar onExport={exportPNG} exporting={exporting} onFit={()=>{setFocus(null);setFitRevision(r=>r+1);}}/>
   {selected&&!activeFocus&&<RoomInfo room={selected}/>}
 </div>;
}
