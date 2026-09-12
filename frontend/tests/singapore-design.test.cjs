const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const test=require('node:test'),assert=require('node:assert/strict');
const storage=new Map();global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
global.window={localStorage:global.localStorage};
test('applying a local design is undoable and portable without mutating the plan',()=>{
 const {useDesignStore}=require('../src/store/design-store.ts');const {bundleInteriors,readInteriors}=require('../src/lib/interior-project.ts');
 const store=useDesignStore;store.getState().initialize(scene);const old={items:store.getState().items,finishes:store.getState().finishes};
 store.getState().applySingaporeStyle(scene,'hdb');const result={items:store.getState().items,finishes:store.getState().finishes};
 assert.ok(result.items.some(i=>i.kind==='washer'));assert.deepEqual(readInteriors(bundleInteriors(JSON.stringify({scene}),result)),result);
 store.getState().undo();assert.deepEqual({items:store.getState().items,finishes:store.getState().finishes},old);
 store.getState().redo();assert.deepEqual(store.getState().items,result.items);
});
const {catalog,validateDesign,fitsRoom}=require('../src/lib/interior-design.ts');
const room=(id,type,x,z,w,d)=>({id,label:id,type,polygon:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]],area_sqm:w*d,floor_material:'wood_light',wall_color:'#eee8df'});
const scene={metadata:{source_file:'original.png',floor_height_m:2.7},rooms:[room('living','living',0,0,5,5),room('bed','bedroom',5,0,3.5,4),room('kitchen','kitchen',0,5,3,4),room('yard','yard',3,5,2,3)],doors:[],windows:[],walls:[],furniture:[]};
test('Singapore furnishing vocabulary includes actual local fittings, not label-only presets',()=>{
 for(const kind of ['tv-wall','shoe-cabinet','sg-kitchen','washer','laundry-tower','drying-rack','aircon','ceiling-fan'])assert.ok(catalog.some(c=>c.kind===kind),kind);
});
test('local living-room seating faces its relocated built-in TV rather than the old console position',()=>{
 const {designSingaporeHome}=require('../src/lib/singapore-design.ts');const d=designSingaporeHome({...scene,windows:[{id:'window',position:[2.5,5],width_m:5}]},'hdb'),tv=d.items.find(i=>i.kind==='tv-wall'),sofa=d.items.find(i=>i.kind==='sofa');
 assert.ok(tv&&sofa);assert.equal((sofa.rotation-tv.rotation+360)%360,180);
 const angle=sofa.rotation*Math.PI/180;assert.ok((tv.x-sofa.x)*Math.sin(angle)+(tv.z-sofa.z)*Math.cos(angle)>0);
});
test('mounted local fittings do not consume floor space and wall units avoid openings',()=>{
 const {placeSingaporeFitting}=require('../src/lib/singapore-design.ts');const r=scene.rooms[0];
 const floor=[{id:'sofa',kind:'sofa',roomId:r.id,x:2.5,z:2.5,rotation:0,scale:1,color:'#aaaaaa'}];
 assert.ok(placeSingaporeFitting('ceiling-fan',r,scene,floor,'fan'));
 const blocked={...scene,windows:[{position:[2.5,0],width_m:5},{position:[5,2.5],width_m:5},{position:[2.5,5],width_m:5},{position:[0,2.5],width_m:5}]};
 assert.equal(placeSingaporeFitting('aircon',r,blocked,floor,'ac'),null);
});
test('HDB and condo are distinct editable designs, preserving all source geometry',()=>{
 const {designSingaporeHome}=require('../src/lib/singapore-design.ts');const before=JSON.stringify(scene);
 const hdb=designSingaporeHome(scene,'hdb'),condo=designSingaporeHome(scene,'condo');
 assert.equal(JSON.stringify(scene),before);assert.ok(validateDesign(hdb));assert.ok(validateDesign(condo));
 for(const d of [hdb,condo]){assert.ok(d.items.some(i=>i.kind==='tv-wall'));assert.ok(d.items.some(i=>i.kind==='aircon'));assert.ok(d.items.some(i=>i.kind==='sg-kitchen'));assert.ok(d.items.every(i=>fitsRoom(i,scene.rooms.find(r=>r.id===i.roomId))));}
 assert.ok(hdb.items.some(i=>i.roomId==='yard'&&i.kind==='washer'));assert.ok(hdb.items.some(i=>i.kind==='drying-rack'));
 assert.ok(condo.items.some(i=>i.kind==='laundry-tower'));assert.ok(!condo.items.some(i=>i.kind==='drying-rack'));assert.notDeepEqual(hdb,condo);
 assert.equal(hdb.finishes.living.floor,'tile_white');assert.equal(condo.finishes.bed.floor,'wood_dark');
});
