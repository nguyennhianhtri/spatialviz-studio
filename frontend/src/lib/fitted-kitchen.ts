/** Original procedural joinery in metres. No layout edits or external assets.
 * The 2.4 x .7 m envelope matches the existing sg-kitchen catalog/placement.
 * Separate slabs leave a real sink void; a painted rectangle on a solid worktop does not.
 */
export interface KitchenPart {
  id:string;
  size:[number,number,number];
  at:[number,number,number];
  color:string;
  metal?:number;
  glow?:boolean;
}
export function fittedKitchenParts(color:string):KitchenPart[] {
  const parts:KitchenPart[]=[];
  const box=(id:string,size:KitchenPart['size'],at:KitchenPart['at'],finish=color,metal=0,glow=false)=>parts.push({id,size,at,color:finish,metal,glow});
  const stone='#e7e2d7',upper='#ddd7c7',steel='#a6b2ae',shadow='#50574e';
  // A carcass assembled from boards, not a solid block that would fill the sink.
  box('recessed-plinth',[2.36,.11,.49],[0,.055,-.06],shadow);
  box('carcass-bottom',[2.4,.024,.63],[0,.122,-.01]);
  box('carcass-back',[2.4,.7,.025],[0,.49,-.3125]);
  for(const [i,x] of [-1.191,-.6,0,1.191].entries())box(`carcass-side-${i}`,[.018,.706,.63],[x,.487,-.01]);
  for(const [i,x] of [-.9,-.3,.3,.9].entries()) {
    if(i!==1)box(`base-door-${i}`,[.584,.69,.02],[x,.477,.33]);
    box(`base-grip-${i}`,[.556,.014,.014],[x,.814,.321],shadow);
  }
  // A shallow cutlery drawer above two deeper drawers; plumbing stays behind paired doors.
  for(const [i,y,h] of [[0,.73,.18],[1,.508,.24],[2,.256,.24]]) {
    box(`drawer-front-${i}`,[.584,h,.02],[-.3,y,.33]);
    box(`drawer-grip-${i}`,[.548,.012,.014],[-.3,y+h/2-.009,.321],shadow);
  }
  box('counter-left',[1.6,.04,.7],[-.4,.86,0],stone);
  box('counter-right',[.3,.04,.7],[1.05,.86,0],stone);
  box('counter-behind-sink',[.5,.04,.19],[.65,.86,-.255],stone);
  box('counter-before-sink',[.5,.04,.17],[.65,.86,.265],stone);
  // Stainless basin: bottom, four walls and a narrow rim, with no face over the opening.
  box('sink-bottom',[.5,.012,.34],[.65,.71,.01],steel,.75);
  box('sink-wall-left',[.02,.17,.34],[.41,.79,.01],steel,.75);
  box('sink-wall-right',[.02,.17,.34],[.89,.79,.01],steel,.75);
  box('sink-wall-back',[.46,.17,.03],[.65,.79,-.145],steel,.75);
  box('sink-wall-front',[.46,.17,.03],[.65,.79,.165],steel,.75);
  box('sink-rim-left',[.03,.008,.36],[.405,.884,.01],steel,.75);
  box('sink-rim-right',[.03,.008,.36],[.895,.884,.01],steel,.75);
  box('sink-rim-back',[.48,.008,.03],[.65,.884,-.145],steel,.75);
  box('sink-rim-front',[.48,.008,.03],[.65,.884,.165],steel,.75);
  box('backsplash',[2.38,.62,.025],[0,1.19,-.326],'#eee9de');
  box('upper-carcass',[2.4,.6,.3],[0,1.82,-.176],upper);
  for(const [i,x] of [-.9,-.3,.3,.9].entries()) {
    box(`upper-door-${i}`,[.584,.568,.025],[x,1.832,-.01],upper);
    box(`upper-grip-${i}`,[.556,.012,.009],[x,1.539,-.021],shadow);
    box(`under-cabinet-light-${i}`,[.56,.012,.015],[x,1.509,-.016],'#ffe3b0',0,true);
  }
  return parts;
}
