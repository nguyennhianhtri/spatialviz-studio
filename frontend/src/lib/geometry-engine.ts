import type { SceneGraph, DoorDef, WindowDef } from "../types/scene";

/** Topology is derived without snapping or averaging survey coordinates. */
export interface Point2D { x: number; y: number }
export interface DerivedEdge {
  start: Point2D; end: Point2D; rooms: string[];
  type: "exterior" | "interior"; thickness: number; height: number;
  length: number; angle: number; midpoint: Point2D;
  isBalconyExterior: boolean; sourceWallIds: string[];
}
export interface DoorPlacement { door: DoorDef; edge: DerivedEdge; t: number }
export interface WindowPlacement { window: WindowDef; edge: DerivedEdge; t: number }
export interface DerivedScene { edges: DerivedEdge[]; doors: DoorPlacement[]; windows: WindowPlacement[] }
const EPS = 1e-6;
const point = (p: [number, number]): Point2D => ({ x: p[0], y: p[1] });
const distance = (a: Point2D, b: Point2D) => Math.hypot(b.x-a.x, b.y-a.y);
function parameter(p: Point2D, a: Point2D, b: Point2D) {
  const dx=b.x-a.x, dy=b.y-a.y;
  return ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1);
}
function onLine(p: Point2D, a: Point2D, b: Point2D) {
  return Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x)) / (distance(a,b)||1) < EPS;
}
function onSegment(p: Point2D, a: Point2D, b: Point2D) {
  const t=parameter(p,a,b); return onLine(p,a,b) && t >= -EPS && t <= 1+EPS;
}
function key(a: Point2D, b: Point2D) {
  const ends=[`${a.x.toFixed(6)},${a.y.toFixed(6)}`,`${b.x.toFixed(6)},${b.y.toFixed(6)}`];
  return ends.sort().join(':');
}

export function deriveSceneGeometry(scene: SceneGraph): DerivedScene {
  const roomEdges = scene.rooms.flatMap(room => room.polygon.map((p,i) => ({
    start: point(p), end: point(room.polygon[(i+1)%room.polygon.length]), rooms: [room.id], sourceWallIds: [] as string[], thickness: 0, height: 0,
  }))).filter(e => distance(e.start,e.end)>EPS);
  const sourceEdges = scene.walls.map(w => ({start:point(w.start),end:point(w.end),rooms:[] as string[],sourceWallIds:[w.id],thickness:w.thickness_m,height:w.height_m})).filter(e=>distance(e.start,e.end)>EPS);
  // Explicit walls are authoritative. Room boundaries are the fallback, never a snap target.
  const raw = sourceEdges.length ? sourceEdges : roomEdges;
  const atoms = new Map<string, DerivedEdge>();
  for (const edge of raw) {
    const ts = [0,1];
    for (const other of [...raw, ...roomEdges]) for (const p of [other.start,other.end]) {
      if (onSegment(p,edge.start,edge.end)) ts.push(Math.max(0,Math.min(1,parameter(p,edge.start,edge.end))));
    }
    const cuts = [...new Set(ts)].sort((a,b)=>a-b);
    for (let i=0;i<cuts.length-1;i++) {
      if (cuts[i+1]-cuts[i]<EPS) continue;
      const at=(t:number) => ({x:edge.start.x+(edge.end.x-edge.start.x)*t,y:edge.start.y+(edge.end.y-edge.start.y)*t});
      const start=at(cuts[i]), end=at(cuts[i+1]), id=key(start,end);
      const existing=atoms.get(id);
      const midpoint=at((cuts[i]+cuts[i+1])/2);
      const rooms=[...new Set([...edge.rooms,...roomEdges.filter(r=>onSegment(midpoint,r.start,r.end)).flatMap(r=>r.rooms)])];
      if (existing) { existing.rooms=[...new Set([...existing.rooms,...rooms])]; existing.sourceWallIds.push(...edge.sourceWallIds); continue; }
      atoms.set(id, {start,end,rooms,type:'exterior',thickness:edge.thickness,height:edge.height||scene.metadata.floor_height_m||2.8,
        length:distance(start,end),angle:Math.atan2(end.y-start.y,end.x-start.x),midpoint,isBalconyExterior:false,sourceWallIds:[...edge.sourceWallIds]});
    }
  }
  const edges=[...atoms.values()].filter(edge => {
    const rooms=scene.rooms.filter(r=>edge.rooms.includes(r.id));
    if(rooms.length>1 && rooms[0].merge_group && rooms.every(r=>r.merge_group===rooms[0].merge_group)) return false;
    edge.type=rooms.length>1?'interior':'exterior'; edge.thickness=edge.thickness>0?edge.thickness:(rooms.length>1?0.12:0.18);
    edge.isBalconyExterior=edge.type==='exterior' && rooms.some(r=>['balcony','yard'].includes(r.type));
    return true;
  });
  function nearest(position: [number,number], wallId: string) {
    const p=point(position);
    const hosted=edges.filter(e=>e.sourceWallIds.includes(wallId));
    return (hosted.length?hosted:edges).map(edge=> { const t=Math.max(0,Math.min(1,parameter(p,edge.start,edge.end)));
      return {edge,t,d:distance(p,{x:edge.start.x+t*(edge.end.x-edge.start.x),y:edge.start.y+t*(edge.end.y-edge.start.y)})};
    }).sort((a,b)=>a.d-b.d)[0];
  }
  function clipped(p:NonNullable<ReturnType<typeof nearest>>,width:number) {
    const host=p.edge;
    const intervals=edges.filter(e=>Math.abs(Math.sin(e.angle-host.angle))<EPS && onLine(e.start,host.start,host.end)).map(e=>{
      const a=parameter(e.start,host.start,host.end)*host.length,b=parameter(e.end,host.start,host.end)*host.length;
      return [Math.min(a,b),Math.max(a,b)];
    }).sort((a,b)=>a[0]-b[0]);
    const unions:number[][]=[];
    for(const range of intervals){const last=unions[unions.length-1];if(last&&range[0]<=last[1]+EPS) last[1]=Math.max(last[1],range[1]);else unions.push([...range]);}
    const center=p.t*host.length,range=unions.find(r=>center>=r[0]-EPS&&center<=r[1]+EPS);
    if(!range) return null;
    const left=Math.max(range[0],center-width/2),right=Math.min(range[1],center+width/2);
    return right-left>0.12?{t:(left+right)/2/host.length,width:right-left}:null;
  }
  const doors: DoorPlacement[]=[]; const windows: WindowPlacement[]=[];
  for (const door of scene.doors) {
    const p=nearest(door.position,door.wall_id);if(!p||p.d>0.3||door.width_m<=0) continue;
    const fit=clipped(p,door.width_m);if(fit) doors.push({door:{...door,width_m:fit.width},edge:p.edge,t:fit.t});
  }
  for (const window of scene.windows) {
    const p=nearest(window.position,window.wall_id);if(!p||p.d>0.3||window.width_m<=0) continue;
    const fit=clipped(p,window.width_m);if(fit) windows.push({window:{...window,width_m:fit.width},edge:p.edge,t:fit.t});
  }
  return {edges,doors,windows};
}

export interface WallSolid { x: number; y: number; w: number; h: number }
/** Exact rectangular subtraction in wall-local coordinates. Never cuts a perpendicular T-wall. */
export function wallSolidSegments(edge: DerivedEdge, doors: DoorPlacement[], windows: WindowPlacement[], height = edge.height): WallSolid[] {
  const half=edge.length/2;
  const holes: {left:number;right:number;bottom:number;top:number}[]=[];
  const add=(host:DerivedEdge,t:number,width:number,bottom:number,top:number) => {
    if(Math.abs(Math.sin(host.angle-edge.angle))>EPS || !onLine(host.start,edge.start,edge.end)) return;
    const p={x:host.start.x+t*(host.end.x-host.start.x),y:host.start.y+t*(host.end.y-host.start.y)};
    const center=parameter(p,edge.start,edge.end)*edge.length-half;
    const left=Math.max(-half,center-width/2),right=Math.min(half,center+width/2);
    bottom=Math.max(0,bottom); top=Math.min(height,top);
    if(right-left>EPS && top-bottom>EPS) holes.push({left,right,bottom,top});
  };
  doors.forEach(p=>add(p.edge,p.t,p.door.width_m,0,Math.min(2.15,p.edge.height)));
  windows.forEach(p=>add(p.edge,p.t,p.window.width_m,p.window.sill_height_m,p.window.sill_height_m+p.window.height_m));
  const xs=[...new Set([-half,half,...holes.flatMap(o=>[o.left,o.right])])].sort((a,b)=>a-b);
  const solids: WallSolid[]=[];
  for(let i=0;i<xs.length-1;i++) {
    const left=xs[i],right=xs[i+1],mid=(left+right)/2;
    if(right-left<EPS) continue;
    const intervals=holes.filter(o=>mid>o.left && mid<o.right).sort((a,b)=>a.bottom-b.bottom);
    let y=0;
    const push=(bottom:number,top:number)=> { if(top-bottom>EPS) solids.push({x:mid,y:(top+bottom)/2,w:right-left,h:top-bottom}); };
    for(const hole of intervals) {push(y,hole.bottom); y=Math.max(y,hole.top);}
    push(y,height);
  }
  return solids;
}
