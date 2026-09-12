require('./render-test-loader.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const geometry = require('../src/lib/geometry-engine.ts');
const room = (id, x, z, w, d, extra = {}) => ({ id, label: id, type: 'living', area_sqm: w*d, polygon: [[x,z],[x+w,z],[x+w,z+d],[x,z+d]], floor_material: 'wood_light', wall_color: '#fff', ...extra });
const scene = (rooms, extra = {}) => ({ metadata: { floor_height_m: 2.8, total_area_sqm: 0, scale_factor: 1, source_file: '' }, rooms, walls: [], doors: [], windows: [], furniture: [], ...extra });
test('T junction splits a long shared boundary into exactly two interior walls without duplicate exteriors', () => {
 const result = geometry.deriveSceneGeometry(scene([room('a',0,0,4,6), room('b',4,0,3,3), room('c',4,3,3,3)]));
 const boundary = result.edges.filter(e => e.start.x === 4 && e.end.x === 4);
 assert.equal(boundary.length, 2);
 assert.ok(boundary.every(e => e.type === 'interior'));
 assert.equal(boundary.reduce((s,e) => s+e.length,0),6);
});
test('explicit source walls keep precise coordinates, thickness, height and opening host identity', () => {
 const walls = [{id:'a',start:[0.037,0],end:[4.037,0],thickness_m:0.23,height_m:3.1}, {id:'b',start:[0,0.1],end:[4,0.1],thickness_m:0.12,height_m:2.8}];
 const result = geometry.deriveSceneGeometry(scene([], {walls, doors:[{id:'door',wall_id:'b',position:[2,0.01],width_m:0.9,type:'hinged'}]}));
 assert.equal(result.edges.length,2);
 assert.equal(result.edges[0].start.x,0.037);
 assert.equal(result.edges[0].thickness,0.23);
 assert.equal(result.edges[0].height,3.1);
 assert.ok(result.doors[0].edge.sourceWallIds.includes('b'));
});
test('opening frames are clipped to their host wall extent and do not float beyond corners', () => {
 const g=geometry.deriveSceneGeometry(scene([], {walls:[{id:'a',start:[0,0],end:[4,0],height_m:2.8,thickness_m:0.2}],doors:[{id:'d',wall_id:'a',position:[0.15,0],width_m:1,type:'hinged'}]}));
 assert.equal(g.doors.length,1);
 const p=g.doors[0],x=p.edge.start.x+p.t*(p.edge.end.x-p.edge.start.x);
 assert.ok(x-p.door.width_m/2>=-1e-6);
 assert.ok(x+p.door.width_m/2<=4+1e-6);
});
test('opening solids preserve the union of differently sized door/window cuts, not their bounding rectangle', () => {
 assert.equal(typeof geometry.wallSolidSegments, 'function');
 const g=geometry.deriveSceneGeometry(scene([], {walls:[{id:'a',start:[0,0],end:[5,0],height_m:3,thickness_m:0.2}], doors:[{id:'d',wall_id:'a',position:[2,0],width_m:1,type:'hinged'}], windows:[{id:'w',wall_id:'a',position:[2.8,0],width_m:1.2,height_m:1.3,sill_height_m:1}]}));
 const solids=geometry.wallSolidSegments(g.edges[0],g.doors,g.windows);
 const solidAt=(x,y)=>solids.some(s=>Math.abs(x-2.5-s.x)<s.w/2 && Math.abs(y-s.y)<s.h/2);
 assert.equal(solidAt(3.1,0.5),true, 'wall below window must remain');
 assert.equal(solidAt(2,0.5),false, 'door must be open');
 assert.equal(solidAt(3.1,1.5),false, 'window must be open');
 assert.ok(solids.every(s=>s.w>0 && s.h>0 && s.x-s.w/2>=-2.5-1e-6 && s.x+s.w/2<=2.5+1e-6));
});
