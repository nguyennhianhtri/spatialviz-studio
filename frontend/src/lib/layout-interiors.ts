import type { SceneGraph } from '../types/scene';
import { boundsOf, fitsRoom, type InteriorDesign } from './interior-design';

/** Carry a design between revisions of the SAME project, never between imports.
 * Room ids are authoritative. Keep size/rotation/colour and distance from the
 * room origin; do not regenerate deleted pieces or silently squeeze a layout.
 */
export function carryLayoutInteriors(design:InteriorDesign,previous:SceneGraph,next:SceneGraph){
 const items=design.items.map(item=>{
  const oldRoom=previous.rooms.find(r=>r.id===item.roomId);
  const room=next.rooms.find(r=>r.id===item.roomId);
  if(!oldRoom||!room)return item;
  const old=boundsOf(oldRoom),current=boundsOf(room);
  const dx=current.minX-old.minX,dz=current.minZ-old.minZ;
  return dx===0&&dz===0?item:{...item,x:item.x+dx,z:item.z+dz};
 });
 const conflicts=items.filter(item=>!next.rooms.some(room=>room.id===item.roomId&&fitsRoom(item,room)));
 return {items,finishes:design.finishes,conflicts};
}
