// Gold name that rises briefly, then blows away as sand. Falls back to the plain label.
const COVERED=new Set("おつねま一三上下且中丸丹久亀井人今介仙伊佐信倉元光全六兵内利則前助勘勝北千半卜又右叶吉后喜坂場多大夫奈奥奧姫子孝宇守安宗定家寧小就居山島崎川左市師平幸康弘弥強彌後徳德忠成我所持政斎新早昌明春景智朝木本朽杉村条松柄柴柿桃桐條森次正武殿比毛氏永江治法泰津浅淀淺満滿濃熙片玄玉甘田盛直県真石福秀秋稲稻竹筑築粕細経經継綱縣繁織繼美義羽臣興良葉藤蘭虎蜂衛親謙谷豊豐貞賀賴近通達遠郎部酒重野鉄鐵長門間阿院隆須頼馬高鳥黑齋龍龜");
const LIFE=1.25,RISE=26,START=.46,SWEEP=.3,FLY=.46,MAX_GRAINS=420;
const BRUSH='"Yuji Boku Names"',PLAIN='"Hiragino Mincho ProN","Songti SC","Yu Mincho",serif';
globalThis.document?.fonts?.load?.('400 25px '+BRUSH,[...COVERED].join(''))?.catch?.(()=>{});

function nameFont(name,lang,large){
 const scale=large?1.2:1;
 if(lang==='en')return {css:'"Cormorant Garamond",serif',weight:700,size:Math.round(24*scale)};
 if([...name].every(c=>COVERED.has(c)))return {css:BRUSH+','+PLAIN,weight:400,size:Math.round(26*scale)};
 return {css:PLAIN,weight:700,size:Math.round(24*scale)};
}
// A private generator keeps visual effects from disturbing any seeded game randomness.
function randomSource(seed){let s=seed>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
function grains(doc,name,font,D){
 const spec=font.weight+' '+font.size+'px '+font.css,probe=doc.createElement('canvas').getContext?.('2d');
 if(!probe)return null;
 probe.font=spec;
 const w=Math.ceil(probe.measureText(name).width)+16,h=Math.ceil(font.size*1.6),text=doc.createElement('canvas');
 text.width=w*D;text.height=h*D;
 const g=text.getContext('2d',{willReadFrequently:true});
 if(!g?.getImageData)return null;
 g.scale(D,D);g.font=spec;g.textAlign='center';g.textBaseline='middle';
 const gold=g.createLinearGradient(0,h*.15,0,h*.85);gold.addColorStop(0,'#fff6c9');gold.addColorStop(.48,'#ffdc7c');gold.addColorStop(1,'#d39a35');
 g.fillStyle=gold;g.fillText(name,w/2,h/2);
 const data=g.getImageData(0,0,text.width,text.height).data,step=D>1?2:1,found=[];
 for(let y=0;y<text.height;y+=step)for(let x=0;x<text.width;x+=step){const o=(y*text.width+x)*4;if(data[o+3]>=110)found.push([x,y,data[o],data[o+1],data[o+2]]);}
 const random=randomSource(name.length*7919+found.length),keep=Math.min(1,MAX_GRAINS/Math.max(1,found.length)),size=step/D/Math.sqrt(keep);
 const parts=found.filter(()=>random()<keep).map(([x,y,r,gr,b])=>({x:x/D,y:y/D,color:random()<.14?'#fffbe8':'rgb('+r+','+gr+','+b+')',delay:START+x/text.width*SWEEP+random()*.08,vx:16+random()*30,vy:-(10+random()*28),wobble:random()*6.28,life:FLY*(.72+random()*.5),size:size*(.9+random()*.5)}));
 const shade=doc.createElement('canvas');shade.width=text.width+24*D;shade.height=text.height+24*D;
 const q=shade.getContext('2d');q.scale(D,D);q.font=spec;q.textAlign='center';q.textBaseline='middle';q.shadowColor='#000';q.shadowBlur=4;q.shadowOffsetY=2;q.fillStyle='rgba(30,14,4,.92)';q.fillText(name,w/2+12,h/2+12);
 return {w,h,parts,shade,D};
}
function paint(ctx,a,t,ox,oy){
 const e=Math.min(1,t/LIFE),rise=RISE*(1-(1-e)*(1-e)),shown=Math.min(1,t/.1);
 ctx.globalAlpha=shown*Math.max(0,1-(t-START)/.34);
 if(ctx.globalAlpha>0)ctx.drawImage(a.shade,ox-12,oy-12-rise,a.shade.width/a.D,a.shade.height/a.D);
 for(const p of a.parts){
  const u=t-p.delay;
  if(u<=0){ctx.globalAlpha=shown;ctx.fillStyle=p.color;ctx.fillRect(ox+p.x,oy+p.y-rise,p.size,p.size);continue;}
  const k=u/p.life;if(k>=1)continue;
  ctx.globalAlpha=(1-k)*(1-k*.25);ctx.fillStyle=p.color;
  const s=p.size*(1-k*.45);ctx.fillRect(ox+p.x+p.vx*u+Math.sin(p.wobble+u*7)*1.6,oy+p.y-rise+p.vy*u-5*u*u,s,s);
 }
 ctx.globalAlpha=1;
}
function plain(doc,root,name,x,y,font){
 const n=doc.createElement('div');n.className='float-name';n.textContent=name;n.style.left=x+'px';n.style.top=y+'px';
 if(font.css.startsWith(BRUSH))n.style.fontFamily=font.css;
 root.appendChild(n);setTimeout(()=>n.remove(),1000);
}
export function playName(root,name,x,y,{doc=globalThis.document,simple=false,lang='ja',large=false,freezeAt=null}={}){
 const font=nameFont(name,lang,large),view=globalThis;
 if(simple||!view.requestAnimationFrame){plain(doc,root,name,x,y,font);return null;}
 let a=null;
 try{a=grains(doc,name,font,Math.min(2,view.devicePixelRatio||1));}catch{a=null;}
 if(!a){plain(doc,root,name,x,y,font);return null;}
 const margin=52,cw=a.w+margin*2,ch=a.h+margin*2,canvas=doc.createElement('canvas');
 canvas.className='name-sand';canvas.setAttribute('aria-hidden','true');canvas.width=cw*a.D;canvas.height=ch*a.D;
 canvas.style.cssText='left:'+(x-cw/2)+'px;top:'+(y-ch/2)+'px;width:'+cw+'px;height:'+ch+'px';
 const ctx=canvas.getContext('2d');ctx.scale(a.D,a.D);root.appendChild(canvas);
 const draw=t=>{ctx.clearRect(0,0,cw,ch);paint(ctx,a,t,margin,margin);};
 if(freezeAt!==null){draw(freezeAt);return canvas;}
 const begin=performance.now(),done=setTimeout(()=>canvas.remove(),(LIFE+.4)*1000);
 const tick=now=>{if(!canvas.isConnected){clearTimeout(done);return;}const t=(now-begin)/1000;if(t>=LIFE+.1){clearTimeout(done);canvas.remove();return;}draw(Math.max(0,t));view.requestAnimationFrame(tick);};
 view.requestAnimationFrame(tick);
 return canvas;
}
