require('./render-test-loader.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const helperPath=path.join(__dirname,'../src/lib/render-layout.ts');
test('camera fitting encloses offset large and narrow plans at portrait and landscape aspect ratios', () => {
 assert.ok(fs.existsSync(helperPath),'render bounds helper must exist');
 const { sceneBounds, fitCamera }=require(helperPath);
 const scene={rooms:[{polygon:[[100,-70],[160,-70],[160,-66],[100,-66]]}],walls:[],metadata:{floor_height_m:3}};
 const b=sceneBounds(scene);
 assert.deepEqual(b.center,[130,1.4,-68]);
 for(const aspect of [0.4,1,2.4]) for(const view of ['orbit','topdown']) {
   const fit=fitCamera(b,aspect,42,view);
   const THREE=require('three'); const camera=new THREE.PerspectiveCamera(42,aspect,0.01,10000);
   camera.position.fromArray(fit.position); camera.lookAt(...b.center); camera.updateMatrixWorld();
   for(const x of [b.minX,b.maxX]) for(const y of [-0.2,b.height]) for(const z of [b.minZ,b.maxZ]) {
     const p=new THREE.Vector3(x,y,z).project(camera);
     assert.ok(Math.abs(p.x)<0.9 && Math.abs(p.y)<0.9,JSON.stringify({view,aspect,p}));
   }
 }
});

test('living rooms receive an in-bounds rug under the seating group', () => {
 const {furnishRoom,footprintFits}=require(helperPath);
 const room={id:'living',type:'living',polygon:[[0,0],[6,0],[6,5],[0,5]]};
 const scene={rooms:[room],doors:[],furniture:[]};
 const items=furnishRoom(room,scene),rug=items.find(i=>i.kind==='rug');
 assert.ok(rug);
 assert.ok(footprintFits(rug,room.polygon,[]));
});
test('furnishing fits concave rooms and excludes the door approach instead of using the bounding rectangle', () => {
 const layout=require(helperPath);
 assert.equal(typeof layout.furnishRoom,'function');
 const room={id:'r',type:'bedroom',polygon:[[0,0],[5,0],[5,2],[2,2],[2,5],[0,5]]};
 const scene={rooms:[room],doors:[{position:[1,0],width_m:1}],furniture:[]};
 const items=layout.furnishRoom(room,scene);
 assert.ok(items.length>0);
 for(const item of items) {
   assert.ok(layout.footprintFits(item,room.polygon,scene.doors),JSON.stringify(item));
 }
 const tiny={...room,polygon:[[0,0],[0.6,0],[0.6,0.6],[0,0.6]]};
 assert.equal(layout.furnishRoom(tiny,{...scene,rooms:[tiny]}).length,0);
});
