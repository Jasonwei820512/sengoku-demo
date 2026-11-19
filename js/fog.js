import {squeezeLeft} from './cavalry.js';
// Fog is attached to tokens, including during gravity and supply.
import {path,linkable,fall,fallSiege,supply,supplySiege,advanceSiege,newSiege,randomize,shuffleLimits,shuffleScore,dispersedShuffle,targetFailed} from './rules.js';
export function fogPairs(board,fog,siege=null){const out=[];const hidden=new Set(fog);for(let a=0;a<56;a++)if(board[a]&&!hidden.has(a))for(let b=a+1;b<56;b++)if(!hidden.has(b)&&linkable(board,a,b,siege))out.push([a,b]);return out;}
export function duelFailed(board,level){return !!level.duel&&!board.includes(1)&&board.includes(9);}
export function fogRemove(board,fog,a,b,level,siege=null){
 if(fog.includes(a)||fog.includes(b)||!linkable(board,a,b,siege))return null;
 return removeFogTiles(board,fog,[a,b],level,siege);
}
export function removeFogTiles(board,fog,cells,level,siege=null){
 const adjacent=i=>cells.some(j=>Math.abs(i%7-j%7)+Math.abs((i/7|0)-(j/7|0))===1);
 const hidden=new Set(fog.filter(i=>!adjacent(i))),tokens=board.map((v,i)=>hidden.has(i)?-v:v);for(const i of cells)tokens[i]=0;
 let next=level.falling?(siege?fallSiege(tokens,level.mask,siege):fall(tokens,level.mask)):tokens;
 if(level.left)next=squeezeLeft(next,level.mask,cells.map(i=>i/7|0),siege);
 return {board:next.map(Math.abs),fog:next.flatMap((v,i)=>v<0?[i]:[])};
}
export function fogSupply(board,fog,queues,level,siege=null){
 const tokens=board.map((v,i)=>fog.includes(i)?-v:v),q=queues.map(c=>c.map(v=>(level.left&&!level.fog)?Math.abs(v):-Math.abs(v)));
 const r=siege?supplySiege(tokens,q,level.mask,siege):supply(tokens,q,level.mask);
 return {board:r.board.map(Math.abs),fog:r.board.flatMap((v,i)=>v<0?[i]:[]),queues:r.queues.map(c=>c.map(Math.abs)),inserted:r.inserted};
}
export function solveFog(board,fog,queues,level,tempo=2,{timeout=1000,siege=level.siege?newSiege(level):null,advance=true,moves=0,betrayalLeft=level.betrayal||0}={}){
 const deadline=performance.now()+timeout,dead=new Set();let timedOut=false;
 function dfs(b,f,q,s,n){if(performance.now()>deadline){timedOut=true;return null;}if(duelFailed(b,level)||targetFailed([...b,...q.flat()],n,level.target))return null;if(!b.some(Boolean)&&!q.flat().length)return [];
 const key=b+'|'+f+'|'+q+'|'+JSON.stringify(s?.layers)+'|'+(level.target?n:n%tempo);if(dead.has(key))return null;
 const visible=b.filter((v,i)=>v&&!f.includes(i));if(!q.flat().length&&f.length&&!visible.some(v=>visible.filter(x=>x===v).length>=2)){dead.add(key);return null;}
 const ps=fogPairs(b,f,s);if(level.target&&b.includes(level.target.person))ps.sort((a,c)=>(b[c[0]]===level.target.person)-(b[a[0]]===level.target.person));if(level.duel)ps.sort((a,c)=>(b[c[0]]===9)-(b[a[0]]===9));
 for(const [a,c]of ps){let r=fogRemove(b,f,a,c,level,s),nq=q,ns=s;if(betrayalLeft>0&&n-moves+1===betrayalLeft)r.board=r.board.map(v=>v===(level.betrayFrom||13)?(level.betrayTo||1):v);if(level.construction&&((n+1)%tempo===0||!r.board.some(Boolean))){r=fogSupply(r.board,r.fog,q,level,s);nq=r.queues;}
 if(s&&advance&&(n+1)%tempo===0)ns=advanceSiege(r.board,s,level.siegeLimit);
 const tail=dfs(r.board,r.fog,nq,ns,n+1);if(tail)return [[a,c],...tail];if(timedOut)return null;
 }dead.add(key);return null;}
 return {solution:dfs(board,fog,queues,siege,moves),timedOut};
}
// Only face-up values are reassigned. Hidden tokens and empty cells stay fixed.
export function shuffleFog(board,fog,siege=null,rng=Math.random,context=null){
 const cells=board.flatMap((v,i)=>v&&!fog.includes(i)?[i]:[]);
 return dispersedShuffle(board,cells,o=>fogPairs(o.board,fog,siege),rng,context?(o,timeout)=>solveFog(o.board,fog,context.queues,context.level,2,{timeout,siege,moves:context.moves||0, betrayalLeft:context.betrayalLeft}).solution:null,siege);
}
