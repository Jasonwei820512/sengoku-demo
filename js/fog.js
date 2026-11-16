import {squeezeLeft} from './cavalry.js';
// Fog is attached to tokens, including during gravity and supply.
import {path,fall,fallSiege,supply,supplySiege,advanceSiege,newSiege,randomize,targetFailed} from './rules.js';
export function fogPairs(board,fog,siege=null){const out=[];const hidden=new Set(fog);for(let a=0;a<56;a++)if(board[a]&&!hidden.has(a))for(let b=a+1;b<56;b++)if(!hidden.has(b)&&path(board,a,b,false,siege))out.push([a,b]);return out;}
export function duelFailed(board,level){return !!level.duel&&!board.includes(1)&&board.includes(9);}
export function fogRemove(board,fog,a,b,level,siege=null){
 if(fog.includes(a)||fog.includes(b)||!path(board,a,b,false,siege))return null;
 const adjacent=i=>[a,b].some(j=>Math.abs(i%7-j%7)+Math.abs((i/7|0)-(j/7|0))===1);
 const hidden=new Set(fog.filter(i=>!adjacent(i))),tokens=board.map((v,i)=>hidden.has(i)?-v:v);tokens[a]=tokens[b]=0;
 let next=level.falling?(siege?fallSiege(tokens,level.mask,siege):fall(tokens,level.mask)):tokens;
 if(level.left)next=squeezeLeft(next,level.mask,[a/7|0,b/7|0],siege);
 return {board:next.map(Math.abs),fog:next.flatMap((v,i)=>v<0?[i]:[])};
}
export function fogSupply(board,fog,queues,level,siege=null){
 const tokens=board.map((v,i)=>fog.includes(i)?-v:v),q=queues.map(c=>c.map(v=>(level.left&&!level.fog)?Math.abs(v):-Math.abs(v)));
 const r=siege?supplySiege(tokens,q,level.mask,siege):supply(tokens,q,level.mask);
 return {board:r.board.map(Math.abs),fog:r.board.flatMap((v,i)=>v<0?[i]:[]),queues:r.queues.map(c=>c.map(Math.abs)),inserted:r.inserted};
}
export function solveFog(board,fog,queues,level,tempo=2,{timeout=1000,siege=level.siege?newSiege(level):null,advance=true}={}){
 const deadline=performance.now()+timeout,dead=new Set();let timedOut=false;
 function dfs(b,f,q,s,n){if(performance.now()>deadline){timedOut=true;return null;}if(duelFailed(b,level)||targetFailed([...b,...q.flat()],n,level.target))return null;if(!b.some(Boolean)&&!q.flat().length)return [];
 const key=b+'|'+f+'|'+q+'|'+JSON.stringify(s?.layers)+'|'+(level.target?n:n%tempo);if(dead.has(key))return null;
 const ps=fogPairs(b,f,s);if(level.target&&b.includes(level.target.person))ps.sort((a,c)=>(b[c[0]]===level.target.person)-(b[a[0]]===level.target.person));if(level.duel)ps.sort((a,c)=>(b[c[0]]===9)-(b[a[0]]===9));
 for(const [a,c]of ps){let r=fogRemove(b,f,a,c,level,s),nq=q,ns=s;if(level.construction&&((n+1)%tempo===0||!r.board.some(Boolean))){r=fogSupply(r.board,r.fog,q,level,s);nq=r.queues;}
 if(s&&advance&&(n+1)%tempo===0)ns=advanceSiege(r.board,s,level.siegeLimit);
 const tail=dfs(r.board,r.fog,nq,ns,n+1);if(tail)return [[a,c],...tail];if(timedOut)return null;
 }dead.add(key);return null;}
 return {solution:dfs(board,fog,queues,siege,0),timedOut};
}
// Only face-up values are reassigned. Hidden tokens and empty cells stay fixed.
export function shuffleFog(board,fog,siege=null,rng=Math.random){
 const cells=board.flatMap((v,i)=>v&&!fog.includes(i)?[i]:[]),values=cells.map(i=>board[i]),out=board.slice();
 for(let n=0;n<30;n++){const labels=randomize(values,rng);cells.forEach((i,k)=>out[i]=labels[k]);if(fogPairs(out,fog,siege).length)return {board:out};}
 const v=values.find(v=>values.filter(x=>x===v).length>=2);
 if(v)for(const a of cells)for(const b of cells)if(a<b&&path(board,a,b,true,siege)){const rest=values.slice();rest.splice(rest.indexOf(v),1);rest.splice(rest.indexOf(v),1);cells.forEach(i=>out[i]=i===a||i===b?v:rest.shift());return {board:out};}
 return {board:out};
}
