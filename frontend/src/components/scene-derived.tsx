"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneGraph, RoomDef } from '@/types/scene';
import { wallSolidSegments, type DerivedEdge, type DoorPlacement, type WindowPlacement } from '@/lib/geometry-engine';
import { furnishRoom, pointInRoom } from '@/lib/render-furnishing';
import { renderPalettes, type StylePreset } from '@/lib/render-palette';
import { floorSurface, floorMaps } from '@/lib/floor-materials';
import { FurnitureObject } from './scene-objects';
import { useSceneStore } from '@/store/scene-store';
import { playerPositionRef, playerKeysRef } from './first-person-controls';


export function roomAnchor(room:RoomDef):[number,number] {
 const pts=room.polygon;if(!pts.length) return [0,0];
 const minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minZ=Math.min(...pts.map(p=>p[1])),maxZ=Math.max(...pts.map(p=>p[1]));
 const center:[number,number]=[(minX+maxX)/2,(minZ+maxZ)/2];
 if(pointInRoom(...center,pts)) return center;
 for(let i=1;i<8;i++) for(let j=1;j<8;j++) {const p:[number,number]=[minX+(maxX-minX)*i/8,minZ+(maxZ-minZ)*j/8];if(pointInRoom(...p,pts)) return p;}
 return pts[0];
}
function RoomLabel({room}:{room:RoomDef}) {
 const texture=useMemo(()=>{
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
   const ctx=canvas.getContext('2d');if(!ctx) return null;
   ctx.fillStyle='rgba(250,247,240,0.94)';ctx.beginPath();ctx.roundRect(4,4,760,120,24);ctx.fill();
   ctx.fillStyle='#504c43';ctx.font='500 42px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   const label=`${room.label} · ${Number(room.area_sqm.toFixed(1))} m²`;ctx.fillText(label,384,64,700);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
 },[room.label,room.area_sqm]);
 useEffect(()=>()=>texture?.dispose(),[texture]);
 const anchor=roomAnchor(room);
 return texture?<sprite position={[anchor[0],0.9,anchor[1]]} scale={[2.25,0.375,1]} renderOrder={10}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false}/></sprite>:null;
}
export function RoomFloor({room,isSelected,onSelect,stylePreset='warm',showLabels=false}:{room:RoomDef;isSelected:boolean;onSelect:()=>void;stylePreset?:StylePreset;showLabels?:boolean}) {
 const shape=useMemo(()=>{const s=new THREE.Shape();room.polygon.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1]));s.closePath();return s;},[room.polygon]);
 const surface=floorSurface(room.floor_material,room.type);
 const palette=renderPalettes[stylePreset];
 return <group onClick={e=>{e.stopPropagation();onSelect();}}>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.16,0]} castShadow receiveShadow><extrudeGeometry args={[shape,{depth:0.16,bevelEnabled:false}]}/><meshStandardMaterial color={palette.cut} roughness={0.94}/></mesh>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.007,0]} receiveShadow><shapeGeometry args={[shape]}/><meshStandardMaterial color={room.floor_material==='wood_dark'?'#786047':surface==='concrete'?'#b1ad9e':surface==='tile'?palette.stone:palette.floor} {...floorMaps(surface)}/></mesh>
   {isSelected&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,0.016,0]}><shapeGeometry args={[shape]}/><meshBasicMaterial color={palette.accent} transparent opacity={0.25} depthWrite={false}/></mesh>}
   {showLabels&&<RoomLabel room={room}/>}
 </group>;
}
/** Camera-facing exterior walls are sectioned; far elevations retain their architectural silhouette. */
export function useWallHeight(edge:DerivedEdge,cutaway:boolean,center:[number,number],topdown=false) {
 const [front,setFront]=useState(true);const current=useRef(true);
 useFrame(({camera})=>{
   if(!cutaway || edge.type==='interior') return;
   const dx=edge.midpoint.x-center[0],dz=edge.midpoint.y-center[1];
   const facing=dx*(camera.position.x-edge.midpoint.x)+dz*(camera.position.z-edge.midpoint.y)>0;
   if(facing!==current.current) {current.current=facing;setFront(facing);}
 });
 if(topdown) return Math.min(edge.height,0.35);
 if(!cutaway) return edge.isBalconyExterior?1.05:edge.height;
 return edge.type==='interior'?Math.min(edge.height,0.95):front?Math.min(edge.height,0.65):edge.isBalconyExterior?1.05:edge.height;
}
interface CutProps { cutaway?:boolean; center?:[number,number]; topdown?:boolean; stylePreset?:StylePreset }
export function DerivedWall({edge,allDoorPlacements=[],allWindowPlacements=[],cutaway=false,center=[0,0],topdown=false,stylePreset='warm',wallColor}:{edge:DerivedEdge;allDoorPlacements?:DoorPlacement[];allWindowPlacements?:WindowPlacement[];wallColor?:string}&CutProps) {
 const h=useWallHeight(edge,cutaway,center,topdown),p=renderPalettes[stylePreset];
 const segments=useMemo(()=>wallSolidSegments(edge,allDoorPlacements,allWindowPlacements,h),[edge,allDoorPlacements,allWindowPlacements,h]);
 return <group position={[edge.midpoint.x,0,edge.midpoint.y]} rotation={[0,-edge.angle,0]}>
   {segments.map((s,i)=><group key={i}><mesh position={[s.x,s.y,0]} castShadow receiveShadow><boxGeometry args={[s.w,s.h,edge.thickness]}/><meshStandardMaterial color={wallColor||p.wall} roughness={0.9}/></mesh>
     {Math.abs(s.y+s.h/2-h)<0.01&&<mesh position={[s.x,h+0.002,0]}><boxGeometry args={[s.w,0.008,edge.thickness+0.005]}/><meshStandardMaterial color={h<edge.height?p.cut:p.wall} roughness={0.9}/></mesh>}
     {s.y-s.h/2<0.01&&[-1,1].map(side=><mesh key={side} position={[s.x,0.05,side*(edge.thickness/2+0.008)]} receiveShadow><boxGeometry args={[s.w,0.1,0.018]}/><meshStandardMaterial color={p.cut} roughness={0.7}/></mesh>)}
   </group>)}
 </group>;
}
export function DerivedDoor({placement,cutaway=false,center=[0,0],topdown=false,stylePreset='warm'}:{placement:DoorPlacement}&CutProps) {
 const {door,edge,t}=placement,p=renderPalettes[stylePreset],h=useWallHeight(edge,cutaway,center,topdown);
 const x=edge.start.x+t*(edge.end.x-edge.start.x),z=edge.start.y+t*(edge.end.y-edge.start.y);
 const width=Math.max(0.1,door.width_m),height=Math.min(2.1,edge.height),view=useSceneStore(s=>s.viewMode);
 const panel=useRef<THREE.Group>(null),open=useRef(true),lastKey=useRef(false);
 useFrame((_,delta)=>{
   if(!panel.current) return;
   const pressed=playerKeysRef.current.has('e');
   if(view==='walkthrough'&&pressed&&!lastKey.current&&Math.hypot(playerPositionRef.current.x-x,playerPositionRef.current.z-z)<2) open.current=!open.current;
   lastKey.current=pressed;
   panel.current.rotation.y=THREE.MathUtils.damp(panel.current.rotation.y,open.current?Math.PI*0.43:0,8,delta);
 });
 const cut=h<height;
 return <group position={[x,0,z]} rotation={[0,-edge.angle,0]}>
   <mesh position={[0,0.016,0]} receiveShadow><boxGeometry args={[width,0.022,edge.thickness+0.05]}/><meshStandardMaterial color={p.wood}/></mesh>
   {!cut&&<>{[-1,1].map(s=><mesh key={s} position={[s*(width/2-0.025),height/2,0]} castShadow><boxGeometry args={[0.05,height,edge.thickness+0.03]}/><meshStandardMaterial color={p.wood}/></mesh>)}<mesh position={[0,height+0.015,0]} castShadow><boxGeometry args={[width,0.05,edge.thickness+0.03]}/><meshStandardMaterial color={p.wood}/></mesh>
     {door.type!=='sliding'&&<group ref={panel} position={[-width/2+0.045,0,0]} rotation={[0,Math.PI*0.43,0]}><mesh position={[(width-0.09)/2,height/2,0]} castShadow><boxGeometry args={[width-0.09,height-0.035,0.035]}/><meshStandardMaterial color={p.wood} roughness={0.67}/></mesh><mesh position={[width-0.15,1,0.04]}><boxGeometry args={[0.09,0.02,0.055]}/><meshStandardMaterial color={p.metal} metalness={0.65} roughness={0.3}/></mesh></group>}
   </>}
 </group>;
}
export function DerivedWindow({placement,cutaway=false,center=[0,0],topdown=false,stylePreset='warm'}:{placement:WindowPlacement}&CutProps) {
 const {window:w,edge,t}=placement,h=useWallHeight(edge,cutaway,center,topdown),p=renderPalettes[stylePreset];
 const bottom=Math.max(0,w.sill_height_m),height=Math.min(w.height_m,h-bottom);
 if(height<0.1) return null;
 const x=edge.start.x+t*(edge.end.x-edge.start.x),z=edge.start.y+t*(edge.end.y-edge.start.y),width=w.width_m;
 return <group position={[x,bottom+height/2,z]} rotation={[0,-edge.angle,0]}>
   {[-1,1].map(s=><group key={s}><mesh position={[s*(width/2-0.018),0,0]} castShadow><boxGeometry args={[0.036,height,edge.thickness+0.02]}/><meshStandardMaterial color={p.metal} roughness={0.45}/></mesh><mesh position={[0,s*(height/2-0.018),0]} castShadow><boxGeometry args={[width,0.036,edge.thickness+0.02]}/><meshStandardMaterial color={p.metal} roughness={0.45}/></mesh></group>)}
   <mesh><boxGeometry args={[0.025,height,0.04]}/><meshStandardMaterial color={p.metal}/></mesh>
   <mesh><boxGeometry args={[Math.max(0.01,width-0.05),Math.max(0.01,height-0.05),0.014]}/><meshStandardMaterial color="#a9c6c0" transparent opacity={0.2} roughness={0.22} metalness={0.12} depthWrite={false}/></mesh>
   <mesh position={[0,-height/2-0.022,0]} castShadow><boxGeometry args={[width+0.08,0.04,edge.thickness+0.16]}/><meshStandardMaterial color={p.stone} roughness={0.65}/></mesh>
 </group>;
}
export function RoomFurniture({room,scene,stylePreset='warm'}:{room:RoomDef;scene:SceneGraph;stylePreset?:StylePreset}) {
 const items=useMemo(()=>furnishRoom(room,scene),[room,scene]);
 return <>{items.map((item,i)=><FurnitureObject key={item.id||`${item.kind}-${i}`} item={item} palette={renderPalettes[stylePreset]}/>)}</>;
}
