require('./render-test-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(name)=>fs.readFileSync(path.join(__dirname,'../src/components',name),'utf8');
test('viewer is an architectural canvas, without demo skies, valuation or report overlays',()=>{
 const source=read('viewer-3d.tsx');
 assert.doesNotMatch(source,/\b(Stars|Grid|ReportPanel|ValuationPanel)\b/);
});
