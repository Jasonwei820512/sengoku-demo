import {path,fall,fallSiege,randomize,advanceSiege,newSiege} from './rules.js';
import {squeezeLeft} from './cavalry.js';
import {fogRemove,fogSupply} from './fog.js';
export const newFire=events=>({events:structuredClone(events),active:[],locked:[],fired:[]});
export function fireMatch(board,ids,state,a,b,siege=null){return state.locked.includes(ids[a])===state.locked.includes(ids[b])&&path(board,a,b,false,siege);}
export function firePairs(board,ids,state,fog=[],siege=null){const out=[];for(let a=0;a<56;a++)if(board[a]&&!fog.includes(a))for(let b=a+1;b<56;b++)if(!fog.includes(b)&&fireMatch(board,ids,state,a,b,siege))out.push([a,b]);return out;}
// Count completed pairs, not seconds. A new ignition does not spend its first turn.
export function tickFire(state,ids,moves,boss=false){const s=structuredClone(state);let penalty=0,failed=false;
 s.active=s.active.filter(e=>e.ids.some(id=>ids.includes(id)));
 for(const e of s.active){e.left--;if(e.left===0){s.locked.push(...e.ids.filter(id=>ids.includes(id)));penalty+=15;if(boss&&e.boss)failed=true;}}
 s.active=s.active.filter(e=>e.left>0);
 s.events.forEach((e,k)=>{if(e.after<=moves&&!s.fired.includes(k)){s.fired.push(k);if(e.ids.every(id=>ids.includes(id)))s.active.push({...e,left:e.turns});}});
 return {state:s,penalty,failed};
}
export function moveIds(ids,a,b,level,siege){let out=ids.slice();out[a]=out[b]=0;if(level.falling)out=siege?fallSiege(out,level.mask,siege):fall(out,level.mask);if(level.left)out=squeezeLeft(out,level.mask,[a/7|0,b/7|0],siege);return out;}
// Shuffle complete tokens within visibility groups: portrait, fire and chain travel together.
export function shuffleFire(board,ids,state,fog=[],siege=null,rng=Math.random){const cells=board.flatMap((v,i)=>v&&!fog.includes(i)?[i]:[]);let b=board.slice(),t=ids.slice();
 for(let n=0;n<60;n++){const order=randomize(cells,rng);cells.forEach((i,k)=>{b[i]=board[order[k]];t[i]=ids[order[k]];});if(firePairs(b,t,state,fog,siege).length)return {board:b,ids:t};}
 for(const a of cells)for(const c of cells)if(a<c&&path(board,a,c,true,siege))for(const u of cells)for(const v of cells)if(u<v&&board[u]===board[v]&&state.locked.includes(ids[u])===state.locked.includes(ids[v])){const rest=cells.filter(i=>i!==u&&i!==v);for(const i of cells){const j=i===a?u:i===c?v:rest.shift();b[i]=board[j];t[i]=ids[j];}return {board:b,ids:t};}
 return {board,ids};
}
export function solveFire(board,queues,level,events,tempo=2,{timeout=1000,worst=false,initialIds=null,initialFire=null}={}){
 const deadline=performance.now()+timeout,dead=new Set();let timedOut=false;
 const startIds=initialIds||board.map((v,i)=>v?i+1:0);let initial=initialFire?structuredClone(initialFire):newFire(events);if(worst){initial.locked=events.flatMap(e=>e.ids);initial.fired=events.map((_,i)=>i);}else if(!initialFire)initial=tickFire(initial,startIds,0).state;
 function dfs(b,ids,f,q,s,fire,n){if(performance.now()>deadline){timedOut=true;return null;}if(!b.some(Boolean)&&!q.flat().length)return [];
 const key=JSON.stringify([b,ids,f,q,s,fire,n]);if(dead.has(key))return null;
 if(!q.flat().length&&!fire.active.length&&fire.fired.length===fire.events.length){const locked=b.filter((v,i)=>v&&fire.locked.includes(ids[i]));if(locked.some(v=>locked.filter(x=>x===v).length%2)){dead.add(key);return null;}}
 for(const [a,c]of firePairs(b,ids,fire,f,s)){let r=fogRemove(b,f,a,c,level,s),ni=moveIds(ids,a,c,level,s),nq=q,ns=s;
 const tick=worst?{state:fire,failed:false}:tickFire(fire,ni,n+1,level.id===10);if(tick.failed)continue;
 if(level.construction&&q.flat().length&&((n+1)%tempo===0||!r.board.some(Boolean))){const supplied=fogSupply(r.board,r.fog,q,level,s);const tmp=fogSupply(ni,[],q.map(col=>col.map(v=>100+v)),{...level,fog:undefined,left:true},s);ni=tmp.board;r=supplied;nq=r.queues;}
 if(s&&(n+1)%tempo===0)ns=advanceSiege(r.board,s,level.siegeLimit);
 const tail=dfs(r.board,ni,r.fog,nq,ns,tick.state,n+1);if(tail)return [[a,c],...tail];if(timedOut)return null;
 }dead.add(key);return null;}
 return {solution:dfs(board,startIds,level.fog||[],queues,level.siege?newSiege(level):null,initial,0),timedOut};
}
