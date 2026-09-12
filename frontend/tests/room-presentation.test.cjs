const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const test=require('node:test'),assert=require('node:assert/strict');
const layout=require('../src/lib/render-layout.ts');
const {sceneBounds,fitCamera}=layout;
test('room presentation includes merged fragments, uses their fitted front, and never edits source geometry',()=>{
 assert.equal(typeof layout.roomPresentation,'function','room-scoped presentation is missing');
 const items=[{id:'tv',kind:'tv-wall',roomId:'living',rotation:270,x:3.8,z:2}];
 const before=JSON.stringify({scene,items});
 const focus=layout.roomPresentation(scene,'alcove',items);
 assert.deepEqual(focus.roomIds,['living','alcove']);
 assert.equal(focus.bounds.maxX,4);assert.equal(focus.bounds.maxZ,6);
 assert.ok(focus.direction[0]<0,'look toward the front of the west-facing TV, even when its sibling fragment is focused');
 assert.equal(layout.roomPresentation(scene,'missing',items),null);
 assert.equal(JSON.stringify({scene,items}),before);
});
const room=(id,x,z,w,d,merge_group)=>({id,label:id,type:'living',polygon:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]],area_sqm:w*d,merge_group});
const scene={metadata:{floor_height_m:2.7},rooms:[room('living',0,0,4,4,'L'),room('alcove',0,4,1,2,'L'),room('bed',4,0,3,4)],walls:[],doors:[],windows:[],furniture:[]};
test('room camera can face the front of west-facing fitted carpentry without changing the default camera',()=>{
 const b=sceneBounds(scene),fit=fitCamera(b,1.5,42,'orbit',[-1,.8,.45]);
 assert.ok(fit.position[0]<b.center[0],'camera must be on the visible front side of the TV, not behind its backing');
 assert.ok(fitCamera(b,1.5,42,'orbit').position[0]>b.center[0]);
 const top=fitCamera(b,1.5,42,'topdown',[-1,.8,.45]);
 assert.ok(Math.abs(top.position[0]-b.center[0])<.001,'topdown keeps its existing overhead orientation');
});
