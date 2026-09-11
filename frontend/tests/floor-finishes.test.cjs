require('./render-test-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const Module=require('node:module');
// Inspect actual R3F material props; hook evaluation is deterministic, GPU proof is separate.
function loadFloor(){
 const filename=path.resolve(__dirname,'../src/components/scene-derived.tsx');
 const mod=new Module(filename,module);mod.paths=module.paths;
 mod.require=(id)=>{
  if(id==='react')return {...require('react'),useMemo:fn=>fn()};
  if(id.startsWith('@/lib/'))return require(path.resolve(__dirname,'../src/lib',id.slice(6)+'.ts'));
  if(id.startsWith('@/')||id==='@react-three/fiber'||id.startsWith('./'))return {};
  return require(id);
 };
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,filename);
 return mod.exports.RoomFloor;
}
const RoomFloor=loadFloor();
function surface(type,floor_material){
 const room={id:'room',type,floor_material,polygon:[[0,0],[4,0],[4,3],[0,3]],area_sqm:12,label:'Room'};
 return RoomFloor({room,isSelected:false,onSelect:()=>{}}).props.children[1].props.children[1].props;
}
test('an explicitly chosen oak floor is the same material in kitchen and living room',()=>{
 assert.ok(surface('kitchen','wood_light').map===surface('living','wood_light').map,'explicit wood must not become kitchen tile');
 assert.equal(surface('kitchen','wood_light').color,surface('living','wood_light').color);
});
test('finish choices have distinct tactile surfaces at metre-based scale',()=>{
 const wood=surface('living','wood_light'),tile=surface('living','tile'),concrete=surface('living','concrete');
 assert.ok(concrete.map!==tile.map,'concrete must not use tile grout');
 for(const material of [wood,tile,concrete]){
  assert.ok(material.bumpMap?.isTexture,'finish needs surface relief');
  assert.ok(material.roughnessMap?.isTexture,'finish needs roughness variation');
  assert.equal(material.map.colorSpace,'srgb');
  assert.equal(material.bumpMap.colorSpace,'');
  assert.ok(material.bumpScale>0&&material.bumpScale<=0.008,'relief must remain subtle, not rocky');
 }
 assert.equal(wood.map.repeat.x,1/2.4);
 assert.equal(wood.map.repeat.y,1/1.44); // eight 180 mm boards, independent of room size
 assert.equal(tile.map.repeat.x,1/1.2); // two 600 mm tiles
 const data=wood.map.image.data;
 let min=255,max=0;for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}
 assert.ok(max-min>35,'wood needs board and grain variation, not nearly flat white noise');
 const boardInterior=Array.from({length:40},(_,y)=>data[((y+8)*512+100)*4]);
 assert.ok(Math.max(...boardInterior)-Math.min(...boardInterior)>=8,'grain must vary within a board, excluding joints');
});
