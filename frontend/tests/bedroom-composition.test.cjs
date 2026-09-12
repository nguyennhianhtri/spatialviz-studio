const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const storage=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
global.window={localStorage:globalThis.localStorage};
const test=require('node:test'),assert=require('node:assert/strict');
const {furnishRoom,itemCorners,fitsRoom}=require('../src/lib/interior-design.ts');
const room={id:'bedroom',type:'bedroom',label:'Bedroom',polygon:[[0,0],[3.2,0],[3.2,3.85],[0,3.85]],area_sqm:12.32,floor_material:'wood_light',wall_color:'#eee8df'};
const doors=[{position:[0,.84],width_m:.83,orientation:'vertical'}];
const box=i=>{const p=itemCorners(i);return {x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),z0:Math.min(...p.map(v=>v[1])),z1:Math.max(...p.map(v=>v[1]))};};
test('room arrangement replaces only the chosen bedroom, preserves finishes, and is undoable',()=>{
 const {useDesignStore}=require('../src/store/design-store.ts');
 const other={...room,id:'other',polygon:room.polygon.map(([x,z])=>[x+5,z])};
 const scene={metadata:{source_file:'test'},rooms:[room,other],doors};
 const edited=[{id:'custom',roomId:room.id,kind:'plant',x:1,z:1,rotation:45,scale:.8,color:'#303733'},{id:'untouched',roomId:other.id,kind:'bed',x:7,z:2,rotation:180,scale:1,color:'#48554e'}];
 const finishes={[room.id]:{floor:'wood_dark',wall:'#bdc5b2'}};
 useDesignStore.setState({items:edited,finishes,past:[],future:[],selected:'custom'});
 assert.equal(useDesignStore.getState().arrangeRoom(room.id,scene),true);
 const arranged=useDesignStore.getState();
 assert.deepEqual(arranged.items.filter(i=>i.roomId===other.id),[edited[1]]);
 assert.deepEqual(arranged.finishes,finishes);assert.equal(arranged.selected,null);
 assert.deepEqual(arranged.items.filter(i=>i.roomId===room.id),furnishRoom(room,doors));
 const result=arranged.items;arranged.undo();assert.deepEqual(useDesignStore.getState().items,edited);
 useDesignStore.getState().redo();assert.deepEqual(useDesignStore.getState().items,result);
 assert.equal(useDesignStore.getState().arrangeRoom('missing',scene),false);
 assert.deepEqual(useDesignStore.getState().items,result);
});
test('compact bedroom coordinates full-size bed with side-wall storage and a usable aisle',()=>{
 const items=furnishRoom(room,doors),bed=items.find(i=>i.kind==='bed'),wardrobe=items.find(i=>i.kind==='wardrobe');
 assert.ok(bed&&wardrobe);assert.equal(bed.scale,1);assert.equal(wardrobe.scale,1);
 assert.equal(Math.abs(bed.rotation-wardrobe.rotation)%180,90,'storage belongs beside the bed, not across its foot');
 const b=box(bed),w=box(wardrobe);
 const aisle=bed.rotation%180===0?Math.max(b.x0-w.x1,w.x0-b.x1):Math.max(b.z0-w.z1,w.z0-b.z1);
 assert.ok(aisle-.05*wardrobe.scale>=.6-1e-8,`clear aisle after wardrobe handle projection ${aisle-.05*wardrobe.scale}`);
 assert.ok(items.every(i=>fitsRoom(i,room)));
 for(const table of items.filter(i=>i.kind==='nightstand')){
  const dx=table.x-bed.x,dz=table.z-bed.z,a=bed.rotation*Math.PI/180;
  assert.ok(Math.abs(dx*Math.sin(a)+dz*Math.cos(a)+.8)<.06,'bedside table stays at the head, never relocated to the foot');
 }
 assert.ok(items.some(i=>i.kind==='nightstand'));
 assert.deepEqual(furnishRoom(room,doors),items,'deterministic');
});
