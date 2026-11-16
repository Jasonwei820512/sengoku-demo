// Decode once and loop the PCM buffer in Web Audio (no HTMLAudio loop gap).
export function createMusic(){
 let ctx,gain,source,kind=null,muted=false,paused=false,token=0,offset=0,began=0;
 const VERSION='C';
 const cache=new Map(),lengths={bgm_ch1:90,bgm_ch1_boss:80,jingle_clear:4};
 function init(){if(!ctx){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return false;ctx=new C();gain=ctx.createGain();gain.connect(ctx.destination);}return true;}
 async function decode(bytes,name){
  // Respect MP4 gapless metadata even in decoders that return encoder padding.
  const tag=new TextDecoder().decode(bytes.slice(0,65536)).match(/ 00000000 ([0-9a-f]{8}) ([0-9a-f]{8}) ([0-9a-f]{16})/i);
  const buffer=await ctx.decodeAudioData(bytes);if(!tag)return buffer;
  const prime=parseInt(tag[1],16),tail=parseInt(tag[2],16),valid=parseInt(tag[3],16),total=prime+tail+valid;
  let start=0;
  if(Math.abs(buffer.duration-(total-1024)/44100)<.002)start=(prime-1024)/44100;
  else if(Math.abs(buffer.duration-total/44100)<.002)start=prime/44100;
  const frames=Math.round(lengths[name]*buffer.sampleRate),from=Math.round(start*buffer.sampleRate);
  if(buffer.length<from+frames-2)return buffer;
  const clean=ctx.createBuffer(buffer.numberOfChannels,frames,buffer.sampleRate);
  for(let c=0;c<buffer.numberOfChannels;c++){const a=clean.getChannelData(c);a.set(buffer.getChannelData(c).subarray(from,from+frames));if(name!=='jingle_clear'){const edge=(a[0]+a[frames-1])/2,head=a[0],tail=a[frames-1],w=Math.round(.003*buffer.sampleRate);for(let i=0;i<w;i++){const g=(1+Math.cos(Math.PI*i/w))/2;a[i]+=(edge-head)*g;a[frames-1-i]+=(edge-tail)*g;}}}
  return clean;
 }
 function stop(){if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
 async function play(name,{resume=false}={}){
  const request=++token;stop();if(!resume)offset=0;kind=name;if(!name||muted||paused||document.hidden||!init())return;
  // Called synchronously during a user gesture before the first await.
  ctx.resume().catch(()=>{});
  try{if(!cache.has(name))cache.set(name,fetch(`audio/${name}_${VERSION}.mp4`).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(b=>decode(b,name)).catch(e=>{cache.delete(name);throw e;}));
   const buffer=await cache.get(name);if(request!==token||muted||paused||document.hidden)return;
   source=ctx.createBufferSource();source.buffer=buffer;source.loop=name!=='jingle_clear';source.loopStart=0;source.loopEnd=Math.min(buffer.duration,lengths[name]);source.connect(gain);
   const node=source;node.onended=()=>{if(source===node&&!node.loop){source=null;kind=null;node.disconnect();}};
   gain.gain.value=name==='jingle_clear'?.55:.22;began=ctx.currentTime;source.start(0,offset%source.loopEnd);
  }catch(e){console.warn('音乐加载失败，可继续游戏',name,e);}
 }
 function suspend(){if(source&&source.loop)offset=(offset+ctx.currentTime-began)%source.loopEnd;++token;stop();}
 return {play,stop(){kind=null;++token;stop();},mute(value){muted=value;gain?.gain.setValueAtTime(value?0:(kind==='jingle_clear'?.55:.22),ctx.currentTime);if(value)suspend();else if(kind)play(kind,{resume:true});},pause(value){paused=value;if(value)suspend();else if(kind)play(kind,{resume:true});},visibility(){if(document.hidden)suspend();else if(kind)play(kind,{resume:true});}};
}
