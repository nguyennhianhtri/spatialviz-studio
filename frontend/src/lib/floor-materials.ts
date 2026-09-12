import * as THREE from 'three';

export type FloorSurface = 'wood' | 'tile' | 'concrete';
/** Explicit finishes win over inferred room use. Unknown source materials use a safe visual default. */
export function floorSurface(material: string, roomType: string): FloorSurface {
 const name=material.toLowerCase();
 if(/concrete|cement/.test(name)) return 'concrete';
 if(/wood|oak|timber|parquet|laminate/.test(name)) return 'wood';
 if(/tile|stone|marble|terrazzo/.test(name)) return 'tile';
 return ['kitchen','bathroom','wc','balcony','yard'].includes(roomType)?'tile':'wood';
}

// Original self-contained procedural materials; no external assets or runtime requests.
// ShapeGeometry UVs are world metres. Shared maps therefore align across room fragments
// without stretching when a room is resized. This bounded cache has only three entries.
const cache=new Map<FloorSurface,ReturnType<typeof makeMaps>>();
const size=512, tau=Math.PI*2;
const byte=(n:number)=>Math.max(0,Math.min(255,Math.round(n)));
function makeMaps(kind:FloorSurface) {
 const albedo=new Uint8Array(size*size*4),height=new Uint8Array(albedo.length),roughness=new Uint8Array(albedo.length);
 for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const u=x/size,v=y/size,i=(y*size+x)*4;
  const noise=((x*1973+y*9277+(x*y)%137)%101)/100-.5;
  const cloud=Math.sin(tau*(u+v))*Math.cos(tau*(2*u-v))*.5+Math.cos(tau*(3*v+u))*.3;
  let tone:number,relief:number,rough:number;
  if(kind==='wood') {
   const row=Math.floor(y/64),localY=y%64;
   const shifted=(x+[0,173,67,239,113,31,197,89][row])%size;
   const board=Math.floor(shifted/256);
   // Longitudinal grain bows gently within each board, rather than noisy cross-grain.
   const bend=Math.sin(tau*u+row)*1.3+Math.sin(tau*2*u+row)*.35;
   const grain=Math.sin(localY*1.55+bend)*3.5+Math.sin(localY*3.3+bend*2)*1.4;
   const variation=((row*7+board*11)%19)-9;
   const seam=localY<1||shifted%256<1;
   tone=seam?164:226+variation+grain+noise*3;
   relief=seam?65:185+grain*1.4+noise*4;
   rough=seam?245:191+grain+noise*6;
  } else if(kind==='tile') {
   const seam=x%256<1||y%256<1;
   const tile=(Math.floor(x/256)+Math.floor(y/256)*3)%4;
   tone=seam?183:238+cloud*6+noise*2-tile*2;
   relief=seam?65:195+cloud*4+noise*3;
   rough=seam?245:175+cloud*12+noise*4;
  } else {
   tone=226+cloud*13+noise*5;
   relief=178+cloud*10+noise*7;
   rough=218+cloud*10+noise*5;
  }
  for(let channel=0;channel<3;channel++) {
   albedo[i+channel]=byte(tone);
   height[i+channel]=byte(relief);
   roughness[i+channel]=byte(rough);
  }
  albedo[i+3]=height[i+3]=roughness[i+3]=255;
 }
 const texture=(data:Uint8Array,color=false)=>{
  const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.anisotropy=8;
  map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
  map.repeat.set(kind==='wood'?1/2.4:1/1.2,kind==='wood'?1/1.44:1/1.2);
  map.needsUpdate=true;return map;
 };
 return {map:texture(albedo,true),bumpMap:texture(height),roughnessMap:texture(roughness),bumpScale:kind==='wood'?.004:kind==='tile'?.006:.003,roughness:1};
}
export function floorMaps(kind:FloorSurface) {
 let maps=cache.get(kind);if(!maps){maps=makeMaps(kind);cache.set(kind,maps);}return maps;
}
