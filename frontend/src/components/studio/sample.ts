import type { SceneGraph } from '../../types/scene';
import type { EditorRoom, EditorDoor, EditorWindow } from '../../store/scene-store';
import { SAMPLE_SCENE } from './sample-fixture';
export function sampleLayout() {
  const rotation = (wallId: string) => { const w = SAMPLE_SCENE.walls.find(w => w.id === wallId); return w && w.start[0] === w.end[0] ? 90 : 0; };
  return {
    editorRooms: SAMPLE_SCENE.rooms.map(r => {
      const xs=r.polygon.map(p=>p[0]), ys=r.polygon.map(p=>p[1]);
      return {id:r.id,name:r.label,type:r.type,x_mm:Math.min(...xs)*1000,y_mm:Math.min(...ys)*1000,width_mm:(Math.max(...xs)-Math.min(...xs))*1000,height_mm:(Math.max(...ys)-Math.min(...ys))*1000};
    }),
    editorDoors: SAMPLE_SCENE.doors.map(d=>({id:d.id,x_mm:d.position[0]*1000,y_mm:d.position[1]*1000,width_mm:d.width_m*1000,type:d.type as EditorDoor['type'],rotation:rotation(d.wall_id)})),
    editorWindows: SAMPLE_SCENE.windows.map(w=>({id:w.id,x_mm:w.position[0]*1000,y_mm:w.position[1]*1000,width_mm:w.width_m*1000,rotation:rotation(w.wall_id)})),
  };
}
/** Offline sample rebuilding only. Real uploads use /api/generate-3d. */
export function sceneFromLayout(rooms: EditorRoom[], doors: EditorDoor[], windows: EditorWindow[], name: string): SceneGraph {
  return {
    metadata:{source_file:name,total_area_sqm:rooms.reduce((n,r)=>n+r.width_mm*r.height_mm/1e6,0),scale_factor:1,floor_height_m:2.8},
    rooms:rooms.map(r=>({id:r.id,label:r.name,type:r.type,area_sqm:r.width_mm*r.height_mm/1e6,polygon:[[r.x_mm/1000,r.y_mm/1000],[(r.x_mm+r.width_mm)/1000,r.y_mm/1000],[(r.x_mm+r.width_mm)/1000,(r.y_mm+r.height_mm)/1000],[r.x_mm/1000,(r.y_mm+r.height_mm)/1000]],floor_material:['bathroom','kitchen','wc'].includes(r.type)?'tile_white':'wood_light',wall_color:'#f4efe5',...(r.merge_group?{merge_group:r.merge_group}:{})})),
    walls:[], doors:doors.map(d=>({id:d.id,position:[d.x_mm/1000,d.y_mm/1000],width_m:d.width_mm/1000,wall_id:'',type:d.type})),
    windows:windows.map(w=>({id:w.id,position:[w.x_mm/1000,w.y_mm/1000],width_m:w.width_mm/1000,height_m:1.4,sill_height_m:.9,wall_id:''})),furniture:[],
  };
}
