const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const test=require('node:test'),assert=require('node:assert/strict');
const {bundleInteriors,readInteriors}=require('../src/lib/interior-project.ts');
test('a downloaded project retains editable furniture and finishes',()=>{
 const item={id:'a',roomId:'room',kind:'sofa',x:2,z:2,rotation:90,scale:1,color:'#aabbcc'};
 const result=bundleInteriors('{"version":1,"projectName":"Home"}',{items:[item],finishes:{room:{floor:'wood_dark',wall:'#ffffff'}}});
 assert.equal(JSON.parse(result).projectName,'Home');assert.deepEqual(readInteriors(result).items,[item]);
});
test('editor-only export never inherits the previous projects furnishings',()=>{
 const stale={items:[{id:'old',roomId:'oldroom',kind:'sofa',x:2,z:2,rotation:0,scale:1,color:'#aabbcc'}],finishes:{oldroom:{floor:'wood_dark',wall:'#ffffff'}}};
 const saved=JSON.parse(bundleInteriors('{"version":1,"stage":"editor","scene":null}',stale));
 assert.deepEqual(saved.interiors,{items:[],finishes:{}});
});
test('drag anchor uses the floor intersection, so an unmoved angled pointer has zero displacement',()=>{
 const {startFurnitureDrag}=require('../src/lib/furniture-drag.ts');const THREE=require('three');
 const ray=new THREE.Ray(new THREE.Vector3(5,5,5),new THREE.Vector3(-1,-1,-1).normalize());
 const anchor=startFurnitureDrag(ray,{x:2,z:3});const floor=ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
 assert.equal(anchor.startX+floor.x-anchor.x,2);assert.equal(anchor.startZ+floor.z-anchor.z,3);
});
test('legacy projects without interiors remain importable',()=>{assert.equal(readInteriors('{"version":1}'),null);});
test('invalid attached interiors fail instead of silently discarding customization',()=>{assert.throws(()=>readInteriors('{"interiors":{"items":[{"kind":"bad"}],"finishes":{}}}'));});
