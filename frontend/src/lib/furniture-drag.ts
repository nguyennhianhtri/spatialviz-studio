import { Plane, Vector3, type Ray } from 'three';
export function startFurnitureDrag(ray:Ray,item:{x:number;z:number}) {
 const hit=ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3());
 return hit?{x:hit.x,z:hit.z,startX:item.x,startZ:item.z}:null;
}
