const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const test=require('node:test'),assert=require('node:assert/strict');
const {bundleInteriors,readInteriors}=require('../src/lib/interior-project.ts');
test('a downloaded project retains editable furniture and finishes',()=>{
 const item={id:'a',roomId:'room',kind:'sofa',x:2,z:2,rotation:90,scale:1,color:'#aabbcc'};
 const result=bundleInteriors('{"version":1,"projectName":"Home"}',{items:[item],finishes:{room:{floor:'wood_dark',wall:'#ffffff'}}});
 assert.equal(JSON.parse(result).projectName,'Home');assert.deepEqual(readInteriors(result).items,[item]);
});
test('legacy projects without interiors remain importable',()=>{assert.equal(readInteriors('{"version":1}'),null);});
test('invalid attached interiors fail instead of silently discarding customization',()=>{assert.throws(()=>readInteriors('{"interiors":{"items":[{"kind":"bad"}],"finishes":{}}}'));});
