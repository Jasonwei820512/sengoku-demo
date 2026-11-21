// Board-space density and flowing textures adapted from the approved prototype.
import {W,H} from './rules.js';
import {mistDistance} from './mist.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const smooth=t=>t*t*(3-2*t);
const edge=(a,b,value)=>smooth(clamp((value-a)/(b-a),0,1));
const noiseTable=new Float32Array(64*64);
let noiseSeed=71;
for(let i=0;i<noiseTable.length;i++){
 noiseSeed=noiseSeed*16807%2147483647;
 noiseTable[i]=noiseSeed/2147483647;
}

function sample(x,y,at){
 const i=Math.floor(x),j=Math.floor(y),u=smooth(x-i),v=smooth(y-j);
 const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
 return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
const noiseAt=(x,y)=>noiseTable[(y&63)*64+(x&63)];
const noise=(x,y)=>sample(x,y,noiseAt);
const stride=W+2;
const gridIndex=(x,y)=>(y+1)*stride+x+1;

export function createMistFx(root,rule,weatherEnabled){
 const document=root.ownerDocument;
 if(!document)return null;
 const canvas=document.createElement('canvas'),mask=document.createElement('canvas');
 const ctx=canvas.getContext?.('2d'),maskCtx=mask.getContext?.('2d');
 if(!ctx||!maskCtx)return null;
 canvas.className='mist-fx';
 canvas.setAttribute('aria-hidden','true');
 root.appendChild(canvas);
 const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const animated=()=>weatherEnabled()&&!motion?.matches;
 const density=new Float32Array(stride*(H+2)),blurred=new Float32Array(density.length);
 const fieldAt=(x,y)=>blurred[gridIndex(clamp(x,-1,W),clamp(y,-1,H))];
 const layers=[
  ['fog_far.png',1.25,.24,.95,5],
  ['fog_mid.png',1,.22,.9,9],
  ['fog_near.png',.85,.26,.8,15]
 ].map(([file,size,spacing,opacity,speed])=>({file,size,spacing,opacity,speed,image:new Image()}));
 let current,geom,imageData,frame=0,last=0,elapsed=0,disposed=false,pulseCell=-1,pulseUntil=0;
 const introDuration=4.2;
 const introDistance=Math.max(...rule.cells.map(i=>mistDistance(i%W,i/W|0,rule.corners)))+4;
 function repaint(now,move){
  if(!imageData)return;
  const dt=last?Math.min(.08,(now-last)/1000):1/30;
  last=now;
  if(move)elapsed+=dt;
  const t=elapsed,front=move?smooth(Math.min(1,t/introDuration))*introDistance-1:Infinity;
  const thickness=1-.22*(1-current.size/rule.cells.length);
  for(let y=-1;y<=H;y++)for(let x=-1;x<=W;x++){
   const cell=clamp(y,0,H-1)*W+clamp(x,0,W-1);
   const distance=mistDistance(x,y,rule.corners);
   const target=current.has(cell)?thickness*clamp((front-distance)/2.2,0,1):0;
   const g=gridIndex(x,y);
   // Clear fast enough to read the tile, then let the last wisps linger.
   const rate=target<density[g]?(density[g]>.26?1.7:.42):1.2;
   density[g]=move?density[g]+(target-density[g])*(1-Math.exp(-dt*rate)):target;
  }
  for(let y=-1;y<=H;y++)for(let x=-1;x<=W;x++){
   let sum=0,weight=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(x+dx< -1||x+dx>W||y+dy< -1||y+dy>H)continue;
    const k=(dx?.55:1)*(dy?.55:1);
    sum+=k*density[gridIndex(x+dx,y+dy)];
    weight+=k;
   }
   blurred[gridIndex(x,y)]=clamp(sum/weight*1.3-.2,0,1);
  }
  const {w,h,gap,spill,width,height}=geom;
  const cw=mask.width,ch=mask.height,data=imageData.data;
  const nudge=move&&now<pulseUntil?Math.sin((pulseUntil-now)/55)*.15:0;
  for(let py=0,o=0;py<ch;py++)for(let px=0;px<cw;px++,o+=4){
   let u=((px+.5)/cw*width-spill-w/2)/(w+gap);
   const v=((py+.5)/ch*height-spill-h/2)/(h+gap);
   if(nudge)u+=nudge*Math.max(0,1-Math.hypot(u-pulseCell%W,v-(pulseCell/W|0))/2.5);
   const field=sample(u,v,fieldAt);
   if(field<.012){data[o+3]=0;continue;}
   const x=u+(noise(u*.55+t*.018,v*1.05)-.5)*.8;
   const y=v+(noise(u*.55+5.3,v*1.05-t*.011)-.5)*.5;
   const base=.62*noise(x*.36-t*.03,y*.62)+.29*noise(x*.82-t*.05+9.1,y*1.35+3.4)+.09*noise(x*1.8-t*.07+3.7,y*2.9+7.2);
   const opacity=edge(.1,.7,field+(base-.5)*1.05*Math.min(1,field*2.2));
   const fade=edge(0,.1,Math.min(px/cw,1-px/cw))*edge(0,.1,Math.min(py/ch,1-py/ch));
   data[o]=data[o+1]=data[o+2]=255;
   data[o+3]=opacity*fade*255;
  }
  maskCtx.putImageData(imageData,0,0);
  const c=canvas.width,d=canvas.height;
  ctx.clearRect(0,0,c,d);
  ctx.fillStyle='rgba(150,147,170,.58)';
  ctx.fillRect(0,0,c,d);
  for(const {image,size,spacing,opacity,speed} of layers){
   if(!image.complete||!image.naturalWidth)continue;
   const z=Math.round(c*size);
   ctx.globalAlpha=opacity;
   for(let row=-1,y=-z*.42;y<d;row++,y+=z*spacing){
    const offset=((t*speed*(row%2?1:.72)+row*z*.37)%z+z)%z;
    for(let x=offset-z;x<c;x+=z)ctx.drawImage(image,Math.floor(x),Math.floor(y),z+1,z);
   }
  }
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='destination-in';
  ctx.drawImage(mask,0,0,c,d);
  ctx.globalCompositeOperation='source-over';
 }
 function tick(now){
  frame=0;
  if(disposed)return;
  if(!animated()){repaint(now,false);return;}
  if(!last||now-last>=33)repaint(now,true);
  frame=requestAnimationFrame(tick);
 }
 function refresh(){
  if(disposed||!geom)return;
  if(!animated()){
   if(frame)cancelAnimationFrame(frame);
   frame=0;
   repaint(performance.now(),false);
  }else if(!frame){
   last=0;
   if(density.some(Boolean))elapsed=Math.max(elapsed,introDuration);
   frame=requestAnimationFrame(tick);
  }
 }
 for(const layer of layers){
  layer.image.onload=refresh;
  layer.image.src='img/fx/'+layer.file;
 }
 motion?.addEventListener?.('change',refresh);
 return {
  update(cells,{w,h,gap}){
   if(w<=0||h<=0)return;
   const changed=current?.size!==cells.length||cells.some(i=>!current.has(i));
   if(changed)current=new Set(cells);
   if(geom?.w!==w||geom?.h!==h||geom?.gap!==gap){
    const spill=w,width=W*w+(W-1)*gap+2*spill,height=H*h+(H-1)*gap+2*spill;
    geom={w,h,gap,spill,width,height};
    canvas.style.cssText=`left:${-spill}px;top:${-spill}px;width:${width}px;height:${height}px`;
    canvas.width=width;canvas.height=height;
    mask.width=Math.ceil(width/4);mask.height=Math.ceil(height/4);
    imageData=maskCtx.createImageData(mask.width,mask.height);
   }else if(!changed)return;
   refresh();
  },
  refresh,
  pulse(i){pulseCell=i;pulseUntil=performance.now()+320;},
  dispose(){
   disposed=true;
   if(frame)cancelAnimationFrame(frame);
   motion?.removeEventListener?.('change',refresh);
   for(const {image} of layers)image.onload=null;
   canvas.width=canvas.height=mask.width=mask.height=0;
   imageData=null;
   canvas.remove();
  }
 };
}
