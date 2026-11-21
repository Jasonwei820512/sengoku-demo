import {solveArtillery} from './artillery.js';
import {path,linkable,fall,fallSiege,randomize,shuffleLimits,shuffleScore,dispersedShuffle,advanceSiege,newSiege,targetFailed,supply,supplySiege} from './rules.js';
import {squeezeLeft} from './cavalry.js';
import {fogRemove,fogSupply} from './ambush.js';
export const newFire=events=>({events:structuredClone(events),active:[],locked:[],fired:[]});
export function fireMatch(board,ids,state,a,b,siege=null){return state.locked.includes(ids[a])===state.locked.includes(ids[b])&&path(board,a,b,false,siege);}
export function firePairs(board,ids,state,fog=[],siege=null){const out=[];for(let a=0;a<56;a++)if(board[a]&&!fog.includes(a))for(let b=a+1;b<56;b++)if(!fog.includes(b)&&state.locked.includes(ids[a])===state.locked.includes(ids[b])&&linkable(board,a,b,siege))out.push([a,b]);return out;}
// Count completed pairs, not seconds. A new ignition does not spend its first turn.
export function tickFire(state,ids,moves,boss=false,hiddenIds=[]){const s=structuredClone(state);let penalty=0,failed=false;
 s.active=s.active.filter(e=>e.ids.every(id=>ids.includes(id)));
 for(const e of s.active){e.left--;if(e.left===0){s.locked.push(...e.ids.filter(id=>ids.includes(id)));penalty+=15;if(boss&&e.boss)failed=true;}}
 s.active=s.active.filter(e=>e.left>0);
 s.events.forEach((e,k)=>{if(e.after<=moves&&!s.fired.includes(k)&&!e.ids.some(id=>hiddenIds.includes(id))){s.fired.push(k);if(e.ids.every(id=>ids.includes(id)))s.active.push({...e,left:e.turns});}});
 return {state:s,penalty,failed};
}
export function moveIds(ids,a,b,level,siege){let out=ids.slice();out[a]=out[b]=0;if(level.falling)out=siege?fallSiege(out,level.mask,siege):fall(out,level.mask);if(level.left)out=squeezeLeft(out,level.mask,[a/7|0,b/7|0],siege);return out;}
// Shuffle complete tokens within visibility groups: portrait, fire and chain travel together.
export function shuffleFire(board,ids,state,fog=[],siege=null,rng=Math.random,context=null){
 const cells=board.flatMap((v,i)=>v&&!fog.includes(i)?[i]:[]);
 const withIds=o=>({...o,ids:o.order?(()=>{const t=ids.slice();cells.forEach((i,k)=>t[i]=ids[o.order[k]]);return t;})():ids.slice()});
 const result=dispersedShuffle(board,cells,o=>{o.ids=withIds(o).ids;return firePairs(o.board,o.ids,state,fog,siege);},rng,context?(o,timeout)=>context.level.noOuter?solveArtillery({board:o.board,queues:context.queues},context.level,2,{timeout,state:{board:o.board,ids:o.ids,fire:state,fog,queues:context.queues,moves:context.moves||0,left:context.betrayalLeft??context.level.betrayal??0,shot:context.shot||0}}):solveFire(o.board,context.queues,{...context.level,...(context.level.ambush?{ambush:fog}:{})},[],2,{timeout,initialIds:o.ids,initialFire:state,siege,moves:context.moves||0, betrayalLeft:context.betrayalLeft}).solution:null,siege);
 return withIds(result);
}

export function solveFire(board,queues,level,events,tempo=2,{timeout=1000,worst=false,initialIds=null,initialFire=null,siege=level.siege?newSiege(level):null,moves=0,betrayalLeft=level.betrayal||0}={}){
 const deadline=performance.now()+timeout,dead=new Set();let timedOut=false;
 const startIds=initialIds||board.map((v,i)=>v?i+1:0);let initial=initialFire?structuredClone(initialFire):newFire(events);if(worst){initial.locked=events.flatMap(e=>e.ids);initial.fired=events.map((_,i)=>i);}else if(!initialFire)initial=tickFire(initial,startIds,0,false,(level.ambush||[]).map(i=>startIds[i])).state;
 function dfs(b,ids,f,q,s,fire,n){if(performance.now()>deadline){timedOut=true;return null;}if(targetFailed([...b,...q.flat()],n,level.target)||level.duel&&!b.includes(1)&&b.includes(9))return null;if(!b.some(Boolean)&&!q.flat().length)return [];
 const key=JSON.stringify([b,ids,f,q,s,fire,n]);if(dead.has(key))return null;
 if(!q.flat().length&&!fire.active.length&&fire.fired.length===fire.events.length){const locked=b.filter((v,i)=>v&&fire.locked.includes(ids[i]));if(locked.some(v=>locked.filter(x=>x===v).length%2)){dead.add(key);return null;}}
 for(const [a,c]of firePairs(b,ids,fire,f,s)){let r=fogRemove(b,f,a,c,level,s),ni=moveIds(ids,a,c,level,s),nq=q,ns=s;
 if(betrayalLeft>0&&n-moves+1===betrayalLeft)r.board=r.board.map(v=>v===(level.betrayFrom||13)?(level.betrayTo||1):v);
 const tick=worst?{state:fire,failed:false}:tickFire(fire,ni,n+1,level.id===10,r.fog.map(i=>ni[i]));if(tick.failed)continue;
 if(level.construction&&q.flat().length&&((n+1)%tempo===0||!r.board.some(Boolean))){const supplied=(level.ambush||level.left)?fogSupply(r.board,r.fog,q,level,s):s?supplySiege(r.board,q,level.mask,s):supply(r.board,q,level.mask);const tokenQ=q.map(col=>col.map(v=>100+v)),tmp=s?supplySiege(ni,tokenQ,level.mask,s):supply(ni,tokenQ,level.mask);ni=tmp.board;r={...supplied,fog:supplied.fog||r.fog};nq=r.queues;}
 if(s&&(n+1)%tempo===0)ns=advanceSiege(r.board,s,level.siegeLimit);
 const tail=dfs(r.board,ni,r.fog,nq,ns,tick.state,n+1);if(tail)return [[a,c],...tail];if(timedOut)return null;
 }dead.add(key);return null;}
 return {solution:dfs(board,startIds,level.ambush||[],queues,siege,initial,moves),timedOut};
}
