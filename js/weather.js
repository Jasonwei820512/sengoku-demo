const native=globalThis.Capacitor?.getPlatform?.()==='ios'||globalThis.location?.protocol==='capacitor:';
const demoPrefix=!native&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('demo')?'demo:':'';
const powerKey=demoPrefix+'sengoku-save-power';
// Pure decoration: reads empty-cell geometry and never mutates the game board.
let canvas,ctx,frame=0,last=0,particles=[],marks=[],enabled=true,options={},audio;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
try{if(!native)enabled=localStorage.getItem(powerKey)!=='1';}catch{}
export const WEATHER_TYPES=['rain-light','rain-heavy','storm','fireflies','mist','sakura','leaves','wind-dust','sun','rapeseed','smoke','embers','embers-smoke','mist-rain','maple','snow','sakura-sunset'];
const rand=(a,b)=>a+Math.random()*(b-a);
function visible(){return enabled&&options.battle&&options.effect&&!options.paused&&!reduced.matches&&!document.hidden;}
function strength(){const p=options.progress?.()||0;return options.fade?Math.max(0,1-Math.max(0,p-.5)*2):1;}
function rain(){return /rain|storm/.test(options.effect||'');}
function sound(){
 const gain=visible()&&rain()&&!options.silent?(options.volume??1)*.028*strength():0;
 if(!gain){if(audio){audio.gain.gain.value=0;audio.context.suspend().catch(()=>{});}return;}
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
 if(!audio){try{const context=new AC(),buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),samples=buffer.getChannelData(0);let smooth=0;for(let i=0;i<samples.length;i++){smooth=(smooth+(Math.random()*2-1)*.035)/1.035;samples[i]=smooth*3;}const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=950;source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start();audio={context,gain};}catch{return;}}
 audio.gain.gain.value=gain;audio.context.resume().catch(()=>{});
}
function resize(){if(!canvas)return;canvas.width=Math.min(innerWidth,560);canvas.height=Math.min(innerHeight,1000);particles=Array.from({length:96},()=>({x:rand(0,canvas.width),y:rand(0,canvas.height),s:rand(0,6),phase:rand(0,7)}));marks=[];}
function ground(dt,snow){
 const cells=options.emptyCells?.()||[];
 // Only current empty cells may carry water/snow, including after undo/supply.
 marks=marks.filter(m=>cells.some(c=>c.id===m.id));
 if(cells.length&&Math.random()<dt*(snow?5:13)){const c=cells[Math.random()*cells.length|0];marks.push({...c,age:0});if(marks.length>24)marks.shift();}
 const sx=canvas.width/innerWidth,sy=canvas.height/innerHeight;
 for(const m of marks){m.age+=dt;const life=snow?3:1;if(m.age>life)continue;const a=Math.sin(m.age/life*Math.PI)*.22;ctx.beginPath();ctx.ellipse(m.x*sx,m.y*sy,(snow?9:3+m.age*13)*sx,(snow?3:1+m.age*4)*sy,0,0,Math.PI*2);if(snow){ctx.fillStyle=`rgba(245,250,255,${a})`;ctx.fill();}else{ctx.strokeStyle=`rgba(212,234,241,${a})`;ctx.stroke();}}
 marks=marks.filter(m=>m.age<(snow?3:1));
}
function draw(t){frame=0;if(!visible())return;frame=requestAnimationFrame(draw);if(t-last<1000/30)return;const dt=Math.min((t-last)/1000,.08);last=t;ctx.clearRect(0,0,canvas.width,canvas.height);const type=options.effect,w=canvas.width,h=canvas.height,intensity=strength();ctx.globalAlpha=intensity;
 if(/mist|smoke/.test(type)){for(let k=0;k<5;k++){ctx.fillStyle=type.includes('smoke')?'rgba(231,222,213,.065)':'rgba(214,231,239,.055)';ctx.beginPath();ctx.ellipse((t/110+k*137)%(w+420)-210,h*(.16+k*.17)+Math.sin(t/5000+k)*18,220,35,0,0,Math.PI*2);ctx.fill();}}
 if(/sun/.test(type)){ctx.save();ctx.rotate(-.3);for(let k=0;k<3;k++){ctx.fillStyle=type.includes('sunset')?'rgba(255,167,90,.055)':'rgba(255,243,191,.06)';ctx.fillRect(w*(.3+k*.28),-100,30+k*15,h*1.5);}ctx.restore();}
 const count=rain()?(type==='storm'?96:type==='rain-heavy'?76:36):type==='fireflies'?7:type==='mist'||type==='smoke'||type==='sun'?0:type==='embers'?Math.min(60,options.count||24):type==='embers-smoke'?72:type==='snow'?52:34;
 for(let i=0;i<count;i++){const p=particles[i];const ember=type.includes('embers'),isRain=rain();p.y+=dt*(isRain?(type==='storm'?820:540):ember?-35-p.s*5:18+p.s*3);p.x+=dt*(isRain?-130:type==='wind-dust'?90:12+Math.sin(t/1300+p.phase)*18);if(p.y>h+20)p.y=-20;if(p.y< -25)p.y=h+15;if(p.x>w+20)p.x=-15;if(p.x< -25)p.x=w+15;
 if(isRain){ctx.strokeStyle='rgba(209,229,237,.23)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-3,p.y+9+p.s);ctx.stroke();continue;}
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(t/1700+p.phase);ctx.beginPath();
 if(type==='fireflies'){ctx.globalAlpha=intensity*(.25+.45*(1+Math.sin(t/900+p.phase))/2);ctx.shadowColor='#dfef87';ctx.shadowBlur=9;ctx.fillStyle='#e4ec9b';ctx.ellipse(0,0,1.4,1.4,0,0,7);}
 else if(type==='snow'){ctx.fillStyle='rgba(245,250,255,.65)';ctx.ellipse(0,0,1+p.s/5,1+p.s/5,0,0,7);}
 else if(type.includes('sakura')){const flip=Math.sin(t/700+p.phase);ctx.scale(Math.max(.16,Math.abs(flip)),1);ctx.fillStyle=flip>0?'rgba(255,207,223,.78)':'rgba(221,151,181,.65)';ctx.moveTo(0,-4);ctx.bezierCurveTo(5,-4,4,2,0,5);ctx.bezierCurveTo(-4,2,-5,-4,-1,-3);ctx.lineTo(0,-1);ctx.closePath();}
 else if(type==='maple'||(type==='leaves'&&i%3!==0)){ctx.fillStyle=type==='maple'?'rgba(195,66,32,.58)':'rgba(161,124,65,.45)';ctx.moveTo(0,-5);for(const [x,y]of [[2,-1],[5,-3],[3,2],[0,5],[-3,2],[-5,-3],[-2,-1]])ctx.lineTo(x,y);ctx.closePath();}
 else {ctx.fillStyle=ember?'rgba(255,141,55,.65)':type==='rapeseed'?'rgba(250,218,93,.65)':'rgba(190,166,121,.25)';ctx.ellipse(0,0,ember?1.5:2.5,ember?3.5:1.3,0,0,7);}
 ctx.fill();ctx.restore();}
 if(rain()||type==='snow')ground(dt,type==='snow');ctx.globalAlpha=1;if(options.fade)sound();
}
function sync(){document.body.classList?.toggle('power-saving',!enabled);cancelAnimationFrame(frame);frame=0;if(canvas){canvas.hidden=!visible();ctx.clearRect(0,0,canvas.width,canvas.height);}sound();if(visible()){last=performance.now();frame=requestAnimationFrame(draw);}}
export function weather(next={}){const changed=next.effect!==undefined&&next.effect!==options.effect;options={...options,...next};if(!next.battle&&next.battle!==undefined)options.effect=undefined;document.body.dataset.boss=String(!!(options.battle&&options.boss));if(!canvas){canvas=document.createElement('canvas');canvas.id='rain';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);ctx=canvas.getContext('2d');resize();}if(changed){resize();}sync();}
export function setWeather(value){enabled=value;sync();}
export function powerButton(button){button.textContent=enabled?'省電: 切':'省電: 入';button.setAttribute('aria-pressed',String(!enabled));button.onclick=()=>{enabled=!enabled;try{if(!native)localStorage.setItem(powerKey,enabled?'0':'1');}catch{}powerButton(button);sync();};}
window.addEventListener('resize',()=>{resize();sync();});document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
// A user gesture can unlock Web Audio after browser autoplay restrictions.
window.addEventListener('pointerdown',()=>{if(visible())sound();});
