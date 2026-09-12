const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const test=require('node:test'),assert=require('node:assert/strict');
const file=require('node:path').join(__dirname,'../src/lib/fitted-kitchen.ts');
const model=fs.existsSync(file)?require(file):{};

test('fitted kitchen has real sink void, recessed toe space and drawer joinery within its unchanged envelope',()=>{
 assert.equal(typeof model.fittedKitchenParts,'function','Missing detailed fitted-kitchen assembly');
 const parts=model.fittedKitchenParts('#8e9b83');
 assert.deepEqual(parts,model.fittedKitchenParts('#8e9b83'),'deterministic procedural geometry');
 assert.equal(new Set(parts.map(p=>p.id)).size,parts.length);
 const byId=id=>{const p=parts.find(p=>p.id===id);assert.ok(p,id);return p;};
 const front=byId('base-door-0'),plinth=byId('recessed-plinth');
 assert.ok(front.at[2]-front.size[2]/2-(plinth.at[2]+plinth.size[2]/2)>=.05,'toe space is physically recessed, not painted onto a solid block');
 assert.equal(parts.filter(p=>p.id.startsWith('drawer-front-')).length,3);
 // Open sink interior: no countertop, carcass or faux solid basin intersects the cavity.
 const voidBox={min:[.42,.735,-.13],max:[.88,.9,.15]};
 for(const p of parts){
  const overlaps=p.at.every((v,j)=>v+p.size[j]/2>voidBox.min[j]+1e-8&&v-p.size[j]/2<voidBox.max[j]-1e-8);
  assert.equal(overlaps,false,`${p.id} fills the sink cavity`);
  assert.ok(p.size.every(n=>n>0&&Number.isFinite(n)),p.id);
  assert.ok(Math.abs(p.at[0])+p.size[0]/2<=1.2+1e-8,`${p.id}: width`);
  assert.ok(Math.abs(p.at[2])+p.size[2]/2<=.35+1e-8,`${p.id}: depth`);
  assert.ok(p.at[1]-p.size[1]/2>=-1e-8&&p.at[1]+p.size[1]/2<=2.12+1e-8,`${p.id}: height`);
 }
 assert.ok(byId('sink-bottom').at[1]<.735);
 assert.equal(parts.filter(p=>p.id.startsWith('sink-wall-')).length,4);
 assert.equal(parts.filter(p=>p.id.startsWith('upper-door-')).length,4);
 const recoloured=model.fittedKitchenParts('#48554e');
 for(let i=0;i<parts.length;i++){
  assert.deepEqual({...parts[i],color:null},{...recoloured[i],color:null},'finish edit must not alter geometry');
  if(parts[i].id.startsWith('drawer-front-')||parts[i].id.startsWith('base-door-'))assert.equal(recoloured[i].color,'#48554e');
 }
 const render=fs.readFileSync(require('node:path').join(__dirname,'../src/components/singapore-furnishings.tsx'),'utf8');
 assert.match(render,/fittedKitchenParts\(c\)\.map/,'the actual renderer consumes the tested assembly');
});
