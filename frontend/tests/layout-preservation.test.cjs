const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const test=require('node:test'),assert=require('node:assert/strict');
const memory=new Map();Object.defineProperty(global,'localStorage',{value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},configurable:true});
global.window={localStorage:global.localStorage};
const {useSceneStore:sceneStore}=require('../src/store/scene-store.ts');
const {useDesignStore:designStore}=require('../src/store/design-store.ts');
const {sceneFromLayout}=require('../src/components/studio/sample.ts');
const room={id:'living',name:'Living',type:'living',x_mm:0,y_mm:0,width_mm:6000,height_mm:5000};
const sofa={id:'my-sofa',roomId:'living',kind:'sofa',x:3,z:2.5,rotation:45,scale:.85,color:'#48554e'};
const finishes={living:{floor:'wood_dark',wall:'#bdc5b2'}};
function setup(){
 sceneStore.getState().reset();sceneStore.getState().setEditorRooms([room]);
 const scene=sceneFromLayout([room],[],[],'Captured home.png');
 sceneStore.getState().setScene(scene);
 assert.equal(designStore.getState().load({items:[{...sofa}],finishes:structuredClone(finishes)},scene),true);
 sceneStore.getState().setStage('editor');return scene;
}
test('correcting a room keeps custom furniture, manual deletions and finishes through viewer initialization',()=>{
 setup();sceneStore.getState().updateEditorRoom('living',{width_mm:6200,name:'Lounge'});
 const next=sceneFromLayout(sceneStore.getState().editorRooms,[],[],'Renamed project');
 sceneStore.getState().setScene(next);designStore.getState().initialize(next);
 assert.deepEqual(designStore.getState().items,[sofa]);
 assert.deepEqual(designStore.getState().finishes,finishes);
 assert.equal(sceneStore.getState().scene.rooms[0].label,'Lounge');
 assert.equal(sceneStore.getState().sceneDirty,false);
});
test('a too-small correction keeps the prior 3D design and offers a named conflict instead of discarding it',()=>{
 const previous=setup();designStore.getState().finish('living',{wall:'#ded6c8'});
 const before=designStore.getState();
 sceneStore.getState().updateEditorRoom('living',{width_mm:1800});
 const next=sceneFromLayout(sceneStore.getState().editorRooms,[],[],'home.png');
 const error=sceneStore.getState().setScene(next);
 assert.match(error,/Living.*Linen sofa/);
 assert.strictEqual(sceneStore.getState().scene,previous);
 assert.equal(sceneStore.getState().stage,'editor');
 assert.equal(sceneStore.getState().sceneDirty,true);
 assert.equal(sceneStore.getState().editorRooms[0].width_mm,1800);
 assert.strictEqual(designStore.getState(),before);
});
test('moving a room carries its furniture by the room-origin delta without scaling or turning it',()=>{
 setup();sceneStore.getState().updateEditorRoom('living',{x_mm:250,y_mm:500});
 const next=sceneFromLayout(sceneStore.getState().editorRooms,[],[],'home.png');
 assert.equal(sceneStore.getState().setScene(next),null);designStore.getState().initialize(next);
 assert.deepEqual(designStore.getState().items,[{...sofa,x:3.25,z:3}]);
 assert.deepEqual(designStore.getState().finishes,finishes);
});
test('a new source with identical geometry does not inherit another projects manual design',()=>{
 const previous=setup();
 sceneStore.getState().setExtraction({inferred_layout:{rooms:[room],doors:[],windows:[]}});
 sceneStore.getState().setScene(previous);designStore.getState().initialize(previous);
 assert.ok(!designStore.getState().items.some(i=>i.id===sofa.id));
 assert.deepEqual(designStore.getState().finishes,{});
});
test('removing a furnished room blocks atomically, while new rooms stay empty and deliberate empty rooms stay empty',()=>{
 const previous=setup();const other={...room,id:'bed',name:'Bedroom',type:'bedroom',x_mm:7000};
 sceneStore.getState().setEditorRooms([other]);
 assert.match(sceneStore.getState().setScene(sceneFromLayout([other],[],[],'home.png')),/Living.*Linen sofa/);
 assert.strictEqual(sceneStore.getState().scene,previous);
 const next=sceneFromLayout([room,other],[],[],'home.png');
 assert.equal(sceneStore.getState().setScene(next),null);designStore.getState().initialize(next);
 assert.deepEqual(designStore.getState().items,[sofa]);
 designStore.getState().remove(sofa.id);
 sceneStore.getState().setScene({...next,metadata:{...next.metadata,source_file:'Renamed'}});
 assert.deepEqual(designStore.getState().items,[]);
 assert.deepEqual(designStore.getState().past,[],'old layout coordinates must not return via furnishing undo');
 const saved=JSON.parse(memory.get('spatialviz-interior-v1')).state;
 assert.deepEqual(saved.items,[]);assert.deepEqual(saved.finishes,finishes);
});
