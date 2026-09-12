const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);

test('room picker exposes existing fitted items by id without requiring a 3D hit or listing another room',()=>{
 const scene={rooms:[{id:'k',label:'Kitchen',type:'kitchen'},{id:'b',label:'Bedroom',type:'bedroom'}]};
 const items=[{id:'kitchen-custom',kind:'sg-kitchen',roomId:'k',color:'#8e9b83',scale:1,x:2,z:1,rotation:0},{id:'bed-private',kind:'bed',roomId:'b',color:'#eeeeee',scale:1,x:5,z:1,rotation:0}];
 const design={items,selected:null,panelOpen:true,finishes:{},past:[],future:[]};
 const sceneState={scene,selectedRoom:'k'};
 const filename=path.resolve(__dirname,'../src/components/interior-panel.tsx');
 const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
 const original=m.require.bind(m);
 // Server rendering needs store snapshots; interactions are verified against real stores in the browser.
 m.require=id=>id==='../store/design-store'?{useDesignStore:()=>design}:id==='../store/scene-store'?{useSceneStore:selector=>selector(sceneState)}:id.endsWith('.module.css')?{}:original(id);
 m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
 const html=renderToStaticMarkup(React.createElement(m.exports.InteriorPanel));
 assert.match(html,/aria-label="Room furnishing"/,'Missing direct room furnishing picker');
 const select=html.match(/<select[^>]*aria-label="Room furnishing"[^>]*>([\s\S]*?)<\/select>/)[1];
 assert.match(select,/value="kitchen-custom"/);
 assert.match(select,/Fitted kitchen with upper cabinets/);
 assert.doesNotMatch(select,/bed-private/);
 assert.deepEqual(design.items,items);
});
