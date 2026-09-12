import { Vector3 } from 'three';
export { furnishRoom, footprintFits, pointInRoom } from './render-furnishing';
import type { SceneGraph } from '../types/scene';
export interface RenderBounds { minX:number; maxX:number; minZ:number; maxZ:number; width:number; depth:number; height:number; center:[number,number,number]; span:number }
export function sceneBounds(scene:SceneGraph):RenderBounds {
  const pts=[...scene.rooms.flatMap(r=>r.polygon),...scene.walls.flatMap(w=>[w.start,w.end])].filter(p=>p.every(Number.isFinite));
  const minX=pts.length?Math.min(...pts.map(p=>p[0])):0,maxX=pts.length?Math.max(...pts.map(p=>p[0])):4;
  const minZ=pts.length?Math.min(...pts.map(p=>p[1])):0,maxZ=pts.length?Math.max(...pts.map(p=>p[1])):4;
  const height=Math.max(scene.metadata.floor_height_m||2.8,...scene.walls.map(w=>w.height_m||0));
  return {minX,maxX,minZ,maxZ,width:maxX-minX,depth:maxZ-minZ,height,center:[(minX+maxX)/2,(height-0.2)/2,(minZ+maxZ)/2],span:Math.max(maxX-minX,maxZ-minZ,height)};
}
/** Solve all eight bounds corners against the horizontal AND vertical frustum, with breathing room. */
export function fitCamera(b:RenderBounds,aspect:number,fov:number,mode:string):{position:[number,number,number];distance:number} {
  const direction=(mode==='topdown'?new Vector3(0,1,0.0001):new Vector3(1,1.18,1.25)).normalize();
  const right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize();
  const up=new Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(fov*Math.PI/360),tanH=tanV*Math.max(0.1,aspect);
  let distance=1;
  for(const x of [b.minX-0.3,b.maxX+0.3]) for(const y of [-0.25,b.height]) for(const z of [b.minZ-0.3,b.maxZ+0.3]) {
    const corner=new Vector3(x-b.center[0],y-b.center[1],z-b.center[2]);
    distance=Math.max(distance,corner.dot(direction)+Math.max(Math.abs(corner.dot(right))/tanH,Math.abs(corner.dot(up))/tanV)*1.12);
  }
  const position=new Vector3(...b.center).addScaledVector(direction,distance).toArray() as [number,number,number];
  return {position,distance};
}
