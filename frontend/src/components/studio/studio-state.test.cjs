const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, filename);
};
test('project state round-trips safely without importing runtime flags or losing the current project on invalid input', () => {
  const {useSceneStore: store} = require('../../store/scene-store.ts');
  const room = {id:'living', name:'Living', type:'living', x_mm:0, y_mm:0, width_mm:4000, height_mm:3000};
  store.getState().reset();
  store.getState().setEditorRooms([room]);
  store.getState().setStage('editor');
  const saved = store.getState().exportProject();
  store.getState().reset();
  store.getState().importProject(saved);
  assert.deepEqual(store.getState().editorRooms, [room]);
  assert.equal(store.getState().stage, 'editor');
  assert.equal(store.getState().isProcessing, false);
  assert.throws(() => store.getState().importProject('{"version":99}'), /project|version/i);
  assert.deepEqual(store.getState().editorRooms, [room]);
});
test('room corrections are undoable, redoable, and invalidate an older 3D result', () => {
  const {useSceneStore: store} = require('../../store/scene-store.ts');
  const room = {id:'r',name:'Room',type:'living',x_mm:0,y_mm:0,width_mm:3000,height_mm:4000};
  store.getState().reset(); store.getState().setEditorRooms([room]);
  store.getState().updateEditorRoom('r', {name:'Study',width_mm:4200});
  assert.equal(store.getState().editorRooms[0].name, 'Study');
  assert.equal(store.getState().sceneDirty, true);
  store.getState().undo(); assert.deepEqual(store.getState().editorRooms, [room]);
  store.getState().redo(); assert.equal(store.getState().editorRooms[0].width_mm,4200);
});
test('successful extraction replaces the prior layout atomically; stopping work preserves corrections', () => {
 const {useSceneStore: store} = require('../../store/scene-store.ts');
 store.getState().setEditorRooms([{id:'old'}]);
 const rooms=[{id:'new',name:'Kitchen',type:'kitchen',x_mm:0,y_mm:0,width_mm:3000,height_mm:2500}];
 store.getState().setExtraction({dimensions:[],room_labels:[],page_width:100,page_height:100,image_base64:'abc',image_mime:'image/png',processing_time_ms:1,inferred_layout:{rooms,doors:[],windows:[],overall_width_mm:3000,overall_height_mm:2500}});
 assert.deepEqual(store.getState().editorRooms,rooms);
 store.getState().setProcessing(true,'Reading your plan'); store.getState().setProcessing(false);
 assert.deepEqual(store.getState().editorRooms,rooms);
 assert.equal(store.getState().sourceKind,'upload');
});
test('explicit sample is local, labelled sample and editable without network', () => {
 const {useSceneStore: store} = require('../../store/scene-store.ts');
 store.getState().loadSample();
 assert.equal(store.getState().sourceKind,'sample');
 assert.ok(store.getState().scene.rooms.length > 1);
 assert.equal(store.getState().editorRooms.length,store.getState().scene.rooms.length);
 assert.equal(store.getState().stage,'viewer');
 const {sceneFromLayout} = require('./sample.ts');
 store.getState().updateEditorRoom('living', {name:'Changed'});
 const next=sceneFromLayout(store.getState().editorRooms,store.getState().editorDoors,store.getState().editorWindows,'Sample');
 assert.equal(next.rooms.find(r=>r.id==='living').label,'Changed');
});
test('API requests are same-origin and expose errors and cancellation without substituting sample data', async () => {
 const {requestJson} = require('./requests.ts');
 const controller=new AbortController(); let seen;
 const result=await requestJson('/api/extract', {method:'POST',signal:controller.signal}, async (url,init)=>{seen=[url,init.signal];return {ok:true,json:async()=>({rooms:[]})};});
 assert.deepEqual(result,{rooms:[]}); assert.equal(seen[0],'/api/extract'); assert.equal(seen[1],controller.signal);
 await assert.rejects(requestJson('/api/extract',{},async()=>({ok:false,json:async()=>({detail:'Plan could not be read'})})),/Plan could not be read/);
 await assert.rejects(requestJson('/api/extract',{},async()=>{throw new DOMException('Cancelled','AbortError');}),{name:'AbortError'});
});
test('browser autosave persists a project and reports storage quota failures without replacing valid saved content', () => {
 const {writeLocalProject,readLocalProject}=require('./persistence.ts');
 const {useSceneStore:store}=require('../../store/scene-store.ts');store.getState().loadSample();
 const memory=new Map();const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
 writeLocalProject(storage,store.getState().exportProject());
 assert.equal(JSON.parse(readLocalProject(storage)).sourceKind,'sample');
 const before=readLocalProject(storage);
 assert.throws(()=>writeLocalProject({getItem:storage.getItem,setItem:()=>{throw new Error('QuotaExceededError');}},'new'),/QuotaExceededError/);
 assert.equal(readLocalProject(storage),before);
});
test('floor plan input accepts supported files and rejects empty, oversized and unsupported files', () => {
  const { validateFloorPlanFile } = require('./project.ts');
  assert.equal(validateFloorPlanFile({name:'home.png', type:'image/png', size:100}), null);
  assert.match(validateFloorPlanFile({name:'home.pdf', type:'application/pdf', size:100}), /Export.*PNG/);
  assert.match(validateFloorPlanFile({name:'home.exe', type:'application/octet-stream', size:100}), /PNG|JPG|PDF/);
  assert.match(validateFloorPlanFile({name:'home.png', type:'image/png', size:0}), /empty/);
  assert.match(validateFloorPlanFile({name:'home.png', type:'image/png', size:21000001}), /20 MB/);
});
