import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoomDef, SceneGraph } from '../types/scene';
import { furnishRoom, getDesignKey, moveItem, placeItem, validateDesign, type DesignItem, type InteriorDesign, type ItemKind, type RoomFinish } from '../lib/interior-design';
interface DesignState extends InteriorDesign {
 sourceKey:string; selected:string|null; panelOpen:boolean; past:InteriorDesign[]; future:InteriorDesign[];
 initialize:(scene:SceneGraph)=>void;
 add:(kind:ItemKind,room:RoomDef)=>boolean;
 update:(id:string,patch:Partial<DesignItem>,room:RoomDef)=>boolean;
 remove:(id:string)=>void; select:(id:string|null)=>void; setPanel:(open:boolean)=>void;
 finish:(roomId:string,patch:Partial<RoomFinish>)=>void; undo:()=>void; redo:()=>void;
 load:(data:unknown,scene:SceneGraph)=>boolean; resetFurnishing:(scene:SceneGraph)=>void;
}
const snapshot=(s:InteriorDesign):InteriorDesign=>({items:s.items,finishes:s.finishes});
const history=(s:DesignState)=>({past:[...s.past.slice(-39),snapshot(s)],future:[]});
export const useDesignStore=create<DesignState>()(persist((set,get)=>({
 sourceKey:'',items:[],finishes:{},selected:null,panelOpen:true,past:[],future:[],
 initialize:(scene)=>{const key=getDesignKey(scene);if(get().sourceKey===key)return;set({sourceKey:key,items:scene.rooms.flatMap(r=>furnishRoom(r,scene.doors)),finishes:{},selected:null,past:[],future:[]});},
 add:(kind,room)=>{const state=get();const item=placeItem(kind,room,state.items.filter(i=>i.roomId===room.id),crypto.randomUUID());if(!item)return false;set({...history(state),items:[...state.items,item],selected:item.id});return true;},
 update:(id,patch,room)=>{const state=get(),item=state.items.find(i=>i.id===id);if(!item)return false;const next=moveItem(item,patch,room);if(!next)return false;set({...history(state),items:state.items.map(i=>i.id===id?next:i)});return true;},
 remove:(id)=>set(s=>({...history(s),items:s.items.filter(i=>i.id!==id),selected:s.selected===id?null:s.selected})),
 select:(selected)=>set({selected}), setPanel:(panelOpen)=>set({panelOpen}),
 finish:(roomId,patch)=>set(s=>({...history(s),finishes:{...s.finishes,[roomId]:{...(s.finishes[roomId]||{floor:'wood_light',wall:'#eee8df'}),...patch}}})),
 undo:()=>set(s=>{const previous=s.past.at(-1);return previous?{...previous,past:s.past.slice(0,-1),future:[snapshot(s),...s.future],selected:null}:{};}),
 redo:()=>set(s=>{const next=s.future[0];return next?{...next,past:[...s.past,snapshot(s)],future:s.future.slice(1),selected:null}:{};}),
 load:(data,scene)=>{const design=validateDesign(data);if(!design||design.items.some(i=>!scene.rooms.some(r=>r.id===i.roomId&&moveItem(i,{},r))))return false;set({...design,sourceKey:getDesignKey(scene),selected:null,past:[],future:[]});return true;},
 resetFurnishing:(scene)=>set(s=>({...history(s),items:scene.rooms.flatMap(r=>furnishRoom(r,scene.doors)),selected:null})),
}),{name:'spatialviz-interior-v1',partialize:s=>({sourceKey:s.sourceKey,items:s.items,finishes:s.finishes}),merge:(stored,current)=>{
 const s=stored as Partial<DesignState>;const valid=validateDesign(s);return valid&&typeof s.sourceKey==='string'?{...current,...valid,sourceKey:s.sourceKey}:current;
}}));
