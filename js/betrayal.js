import {newFire,tickFire,firePairs,moveIds} from './fire.js';
import {fogRemove,fogSupply} from './fog.js';
import {newSiege,advanceSiege,targetFailed} from './rules.js';
export function betray(board,left,from=13,to=1){const next=Math.max(0,left-1);return {board:next===0&&left>0?board.map(v=>v===from?to:v):board.slice(),left:next};}
export function solveBetrayal(board,queues,level,events=[],mode='early',tempo=2,{timeout=150}={}){
 const deadline=performance.now()+timeout,dead=new Set();
 function dfs(b,q,f,ids,fire,s,left,n){if(performance.now()>deadline)return null;if(targetFailed([...b,...q.flat()],n,level.target))return null;if(!b.some(Boolean)&&!q.flat().length)return [];
 if(mode==='early'&&left===0&&b.includes(13))return null;
 const key=JSON.stringify([b,q,f,ids,fire,s,left,n]);if(dead.has(key))return null;
 let ps=firePairs(b,ids,fire,f,s);if(mode==='early')ps.sort((a,c)=>(b[c[0]]===13)-(b[a[0]]===13));
 for(const [a,c]of ps){if(mode==='late'&&left>0&&b[a]===13)continue;
 let r=fogRemove(b,f,a,c,level,s),ni=moveIds(ids,a,c,level,s),nq=q,ns=s;const nb=betray(r.board,left);
 if(mode==='early'&&left===1&&nb.board.filter(v=>v===1).length>r.board.filter(v=>v===1).length)continue;
 r.board=nb.board;const nf=level.fire?tickFire(fire,ni,n+1).state:fire;
 if(level.construction&&q.flat().length&&((n+1)%tempo===0||!r.board.some(Boolean))){const supply=fogSupply(r.board,r.fog,q,{...level,left:true},s);const tokenSupply=fogSupply(ni,[],q.map(col=>col.map(v=>100+v)),{...level,left:true},s);ni=tokenSupply.board;r=supply;nq=supply.queues;}
 if(s&&(n+1)%tempo===0)ns=advanceSiege(r.board,s,level.siegeLimit);
 const tail=dfs(r.board,nq,r.fog,ni,nf,ns,nb.left,n+1);if(tail)return [[a,c],...tail];
 }dead.add(key);return null;}
 const ids=board.map((v,i)=>v?i+1:0),fire=tickFire(newFire(events),ids,0).state;
 return dfs(board,queues,level.fog||[],ids,fire,level.siege?newSiege(level):null,level.betrayal,0);
}
