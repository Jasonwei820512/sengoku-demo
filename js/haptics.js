// All native feedback goes through this scheduler. Web calls are intentional no-ops.
export const EVENTS = Object.freeze({
 match:['impact','LIGHT',2],combo:['impact','MEDIUM',3],comboHigh:['impact','HEAVY',4],
 blocked:['notification','ERROR',3],touchHidden:['impact','LIGHT',1],reveal:['impact','LIGHT',1],
 ignite:['notification','WARNING',4],fireUrgent:['impact','LIGHT',3],extinguish:['notification','SUCCESS',5],
 chain:['impact','HEAVY',6],siege:['impact','MEDIUM',5],cannon:['impact','HEAVY',7],
 betray:['impact','MEDIUM',6],win:['notification','SUCCESS',9],lose:['notification','ERROR',9]
});
const important=new Set(['win','lose','chain','cannon']);
export function createHaptics({plugin=()=>globalThis.Capacitor?.Plugins?.Haptics,isIOS=()=>globalThis.Capacitor?.getPlatform?.()==='ios'||globalThis.location?.protocol==='capacitor:',allowed=()=>true,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 let enabled=true,pending=null,timer=null,second=null,last=-Infinity;
 const safe=kind=>{try{return enabled&&isIOS()&&allowed(kind);}catch{return false;}};
 function clear(){if(timer!==null)cancel(timer);if(second!==null)cancel(second);timer=second=null;pending=null;}
 function invoke(kind){if(!safe(kind)){clear();return;}try{const [method,value]=EVENTS[kind];Promise.resolve(plugin()?.[method]({[method==='impact'?'style':'type']:value})).catch(()=>{});}catch{}last=now();}
 function flush(){timer=null;if(!safe(pending)){clear();return;}const kind=pending;pending=null;if(!kind)return;const wait=90-(now()-last);if(wait>0){if(important.has(kind)){pending=kind;timer=schedule(flush,wait);}return;}invoke(kind);if(kind==='betray'){const repeat=()=>{second=null;if(!safe('betray'))return;const wait=90-(now()-last);if(wait>0){second=schedule(repeat,wait);return;}invoke('betray');};second=schedule(repeat,120);}}
 function emit(kind){try{if(!EVENTS[kind]||!safe(kind))return;if(!pending||EVENTS[kind][2]>EVENTS[pending][2])pending=kind;if(timer===null)timer=schedule(flush,40);}catch{clear();}}
 return {emit,clear,setEnabled(value){enabled=!!value;if(!enabled)clear();}};
}
export const haptics=createHaptics();
export const haptic=(kind,enabled=true)=>{haptics.setEnabled(enabled);if(enabled)haptics.emit(kind);};
// Emit once per state transition, never from rendering (undo/load cannot replay it).
export function fireHaptics(before,after,emit){
 if(before.active.some(e=>!after.active.some(n=>n.ids.join()===e.ids.join())&&!e.ids.some(id=>after.locked.includes(id))))emit('extinguish');
 if(after.locked.some(id=>!before.locked.includes(id)))emit('chain');
 if(after.active.some(e=>!before.active.some(n=>n.ids.join()===e.ids.join())))emit('ignite');
 if(after.active.some(e=>e.left<=2&&before.active.some(n=>n.ids.join()===e.ids.join()&&n.left!==e.left)))emit('fireUrgent');
}
export function revealHaptics(before,after,emit){if(after.length<before.length)emit('reveal');}
