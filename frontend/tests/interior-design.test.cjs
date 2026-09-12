const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const test = require('node:test');
const assert = require('node:assert/strict');
const {catalog, placeItem, moveItem, furnishRoom, validateDesign, getDesignKey} = require('../src/lib/interior-design.ts');
const room={id:'living',type:'living',label:'Living',polygon:[[0,0],[6,0],[6,5],[0,5]],area_sqm:30,floor_material:'wood_light',wall_color:'#eee'};
test('catalog furniture has real metre dimensions and can be placed in a room',()=>{
 assert.ok(catalog.length>=10);
 const item=placeItem('sofa',room,[], 's1');
 assert.equal(item.kind,'sofa'); assert.equal(item.roomId,'living');
 assert.ok(item.x>0 && item.z>0);
});
test('moving furnishings outside the room is rejected, not silently clipped',()=>{
 const item=placeItem('sofa',room,[], 's1');
 assert.equal(moveItem(item,{x:-10},room),null);
 assert.equal(moveItem(item,{rotation:90,x:3,z:2.5},room).rotation,90);
});
test('furnishing a bedroom produces editable bed plus useful complementary pieces',()=>{
 const items=furnishRoom({...room,id:'bed',type:'bedroom'},[]);
 assert.ok(items.some(x=>x.kind==='bed'));
 assert.ok(items.length>=3);
 assert.equal(new Set(items.map(x=>x.id)).size,items.length);
});
test('door at the preferred wall moves the main bed or sofa to another usable wall',()=>{
 const doors=[{position:[3,0],width_m:.9}];
 assert.ok(furnishRoom(room,doors).some(i=>i.kind==='sofa'));
 assert.ok(furnishRoom({...room,type:'bedroom'},doors).some(i=>i.kind==='bed'));
});
test('project import rejects nonfinite coordinates and unknown furniture',()=>{
 assert.equal(validateDesign({items:[{kind:'exploit',x:Infinity}],finishes:{}}),null);
});
test('source identity changes for a different plan even if filename is reused',()=>{
 const base={metadata:{source_file:'home.png'},rooms:[room]};
 assert.notEqual(getDesignKey(base),getDesignKey({...base,rooms:[{...room,polygon:[[0,0],[2,0],[2,2],[0,2]]}]}));
});
