import shuffleBank from './shuffle-bank.js';
export const W=7,H=8;
const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
function covered(mist,x,y){
 return mist?.has(Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x)));
}
export function path(board,a,b,ignoreType=false, siege=null,mist=null){
 if(a===b||mist?.has(a)||mist?.has(b)||!board[a]||!board[b]||(!ignoreType&&board[a]!==board[b]))return null;
 const [sx,sy]=[a%W,Math.floor(a/W)],[tx,ty]=[b%W,Math.floor(b/W)],queue=[],seen=new Map();
 for(let d=0;d<4;d++)queue.push({x:sx,y:sy,d,t:0,p:[[sx,sy]]});
 for(let q=0;q<queue.length;q++){
  const s=queue[q],[dx,dy]=dirs[s.d],x=s.x+dx,y=s.y+dy;
  if(x< -1||x>W||y< -1||y>H||covered(mist,x,y))continue;
  if(siege&&((siege.noOuter||siege.layers.length)&& (x<0||x>=W||y<0||y>=H)||siege.layers.some(r=>r.includes(y*W+x))&&x>=0&&x<W&&y>=0&&y<H))continue;
  const p=[...s.p,[x,y]];if(x===tx&&y===ty)return p;
  if(x>=0&&x<W&&y>=0&&y<H&&board[y*W+x])continue;
  for(let d=0;d<4;d++){const t=s.t+(d!==s.d?1:0);if(t>2)continue;const key=`${x},${y},${d}`;if((seen.get(key)??3)<=t)continue;seen.set(key,t);queue.push({x,y,d,t,p});}
 }return null;
}
// Boolean routing avoids allocating BFS paths in the hot solver/shuffle loop.
export function linkable(board,a,b,siege=null,mist=null){
 if(a===b||mist?.has(a)||mist?.has(b)||!board[a]||board[a]!==board[b])return false;
 const ax=a%7,ay=a/7|0,bx=b%7,by=b/7|0;
 const blocked=new Set(siege?.layers.flat()||[]),noOuter=siege&&(siege.noOuter||siege.layers.length);
 const clear=(x,y)=>{if(covered(mist,x,y))return false;if(x<0||x>=7||y<0||y>=8)return !noOuter;const i=y*7+x;return !blocked.has(i)&&(!board[i]||i===a||i===b);};
 const line=(x,y,u,v)=>{if(x===u){for(let k=Math.min(y,v);k<=Math.max(y,v);k++)if(!clear(x,k))return false;}else{for(let k=Math.min(x,u);k<=Math.max(x,u);k++)if(!clear(k,y))return false;}return true;};
 for(let x=-1;x<=7;x++)if(line(ax,ay,x,ay)&&line(x,ay,x,by)&&line(x,by,bx,by))return true;
 for(let y=-1;y<=8;y++)if(line(ax,ay,ax,y)&&line(ax,y,bx,y)&&line(bx,y,bx,by))return true;
 return false;
}
export function pairs(board){const out=[];for(let a=0;a<56;a++)if(board[a])for(let b=a+1;b<56;b++)if(board[a]===board[b]&&linkable(board,a,b))out.push([a,b]);return out;}
export function hint(board){for(let a=0;a<56;a++)if(board[a])for(let b=a+1;b<56;b++)if(board[a]===board[b]&&linkable(board,a,b))return [a,b];return null;}
export function fall(board,mask){const out=board.slice();for(let x=0;x<W;x++){const cells=mask.filter(i=>i%W===x).sort((a,b)=>a-b),values=cells.map(i=>board[i]).filter(Boolean);cells.forEach((i,j)=>out[i]=values[j-(cells.length-values.length)]||0);}return out;}
export function remove(board,a,b,mask,falling=false){if(!path(board,a,b))return null;const out=board.slice();out[a]=out[b]=0;return falling?fall(out,mask):out;}
export function targetFailed(board,moves,target=false){return Boolean(target&&moves>=(target===true?14:target.beforePairs)&&board.includes(target===true?9:target.person));}
export function solve(board,mask,falling=false,target=false,{timeout=1000,moves=0}={}){
 const deadline=performance.now()+timeout,dead=new Set();let nodes=0,timedOut=false;
 function dfs(b,n){if(performance.now()>deadline){timedOut=true;return null;}nodes++;if(targetFailed(b,n,target))return null;if(!b.some(Boolean))return [];
 const key=b.join(',')+':'+n;if(dead.has(key))return null;const ps=pairs(b);const person=target===true?9:target?.person;if(target&&b.includes(person))ps.sort((a,c)=>(b[c[0]]===person)-(b[a[0]]===person));
 for(const [a,c] of ps){const r=dfs(remove(b,a,c,mask,falling),n+1);if(r)return [[a,c],...r];if(timedOut)return null;}dead.add(key);return null;}
 const solution=dfs(board,moves);return {solution,nodes,timedOut};
}
export function randomize(a,rng=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Reverse insertion yields a guaranteed removal order in reverse.
export function reverseBuild(mask,values,rng=Math.random){
 const labels=randomize(values,rng),b=Array(56).fill(0),todo=mask.slice(),history=[];
 while(todo.length){let found=null;const order=randomize(todo,rng);for(let a=0;a<order.length&&!found;a++)for(let c=a+1;c<order.length;c++){b[order[a]]=b[order[c]]=1;const ok=path(b,order[a],order[c]);b[order[a]]=b[order[c]]=0;if(ok){found=[order[a],order[c]];break;}}
 if(!found)return null;const v=labels.pop();for(const i of found){b[i]=v;todo.splice(todo.indexOf(i),1);}history.unshift(found);}
 return {board:b,solution:history};
}
// Track original tokens while removing bottom pairs. Same-column pairs are
// adjacent; remaining singleton columns connect through the bottom outer ring.
export function fallingBuild(mask,values,target=false,rng=Math.random,falling=true){
 let tokens=Array(56).fill(0);mask.forEach(i=>tokens[i]=i+1);const original=Array(56).fill(0),labels=randomize(values,rng),schedule=[];
 if(target){const person=target===true?9:target.person;labels.sort((a,b)=>(b===person)-(a===person));}
 while(labels.length){let pair=null;for(const x of randomize([...Array(7).keys()],rng)){const cells=mask.filter(i=>i%7===x&&tokens[i]).sort((a,b)=>b-a);if(cells.length>=2){pair=cells.slice(0,2);break;}}
 if(!pair)pair=mask.filter(i=>tokens[i]).slice(0,2);const v=labels.shift();for(const i of pair)original[tokens[i]-1]=v;schedule.push(pair);tokens[pair[0]]=tokens[pair[1]]=0;if(falling)tokens=fall(tokens,mask);}
 return {board:original,solution:schedule};
}
// Exact random expectation for this occupied shape and visible multiset.
export function shuffleLimits(board,cells=board.flatMap((v,i)=>v?[i]:[]),siege=null){
 const counts=new Map();for(const i of cells)counts.set(board[i],(counts.get(board[i])||0)+1);
 const n=cells.length,p=n<2?0:[...counts.values()].reduce((s,k)=>s+k*(k-1),0)/(n*(n-1));let adjacent=0,direct=0;
 for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const i=cells[a],j=cells[b];if(Math.abs(i%7-j%7)+Math.abs((i/7|0)-(j/7|0))===1)adjacent++;if(path(board,i,j,true,siege))direct++;}
 return {adjacent:adjacent*p,direct:direct*p};
}
export function shuffleScore(board,cells,limits,direct){let adjacent=0;const set=new Set(cells);for(const i of cells){if(i%7<6&&set.has(i+1)&&board[i]===board[i+1])adjacent++;if(set.has(i+7)&&board[i]===board[i+7])adjacent++;}
 return Math.max(0,adjacent-Math.floor(limits.adjacent))+Math.max(0,direct-Math.max(1,Math.floor(limits.direct)));
}
// Shared bounded rejection sampler. A validator must certify the whole game
// state (including supplies/targets), rather than merely finding one pair.
export function dispersedShuffle(board,cells,getPairs,rng=Math.random,certify=null,siege=null){
 const start=performance.now(),deadline=start+80,limits=shuffleLimits(board,cells,siege);
 let best={board:board.slice(),verified:false},bestScore=Infinity;
 const consider=out=>{const ps=getPairs(out);if(!ps.length)return false;const cost=shuffleScore(out.board,cells,limits,ps.length);if(cost>=bestScore)return false;
 const proof=certify?certify(out,Math.max(1,Math.min(10,deadline-performance.now()-2))):true;
 if(!proof)return false;best={...out,verified:!!certify};bestScore=cost;return !cost;};
 for(let n=0;n<200&&performance.now()<deadline-12;n++){
 const out={board:board.slice()},order=randomize(cells,rng);cells.forEach((i,k)=>out.board[i]=board[order[k]]);out.order=order;
 if(consider(out))return best;
 }
 // Never replace a hard board with an unchecked adjacent-pair construction.
 if(certify&&!best.verified)consider({board:board.slice(),order:cells.slice()});
 return best;
}
export function shuffle(board,mask,falling=false,target=false,{budget=85,moves=0,rng=Math.random,forceFallback=false,fallbacks=[]}={}){
 const start=performance.now(),values=board.filter(Boolean),counts=new Map();values.forEach(v=>counts.set(v,(counts.get(v)||0)+1));const labels=[];for(const [v,n]of counts)for(let i=0;i<n/2;i++)labels.push(v);
 const occupied=mask.filter(i=>board[i]),limits=shuffleLimits(board,occupied);
 let best=fallingBuild(occupied,labels,target,rng,falling),bestScore=shuffleScore(best.board,occupied,limits,pairs(best.board).length);
 // Prefer the existing certified dispersed layout as the emergency fallback
 // whenever it is still solvable; a stuck position continues to random trials.
 const inputScore=shuffleScore(board,occupied,limits,pairs(board).length);
 if(inputScore<bestScore&&hint(board)&&performance.now()-start<budget-12){const proof=solve(board,mask,falling,target,{timeout:Math.min(8,budget-(performance.now()-start)-8),moves});if(proof.solution){best={board:board.slice(),solution:proof.solution};bestScore=inputScore;}}

 // Development-time opening certificates are an immediate dispersed fallback
 // when the current multiset and occupied shape still match (usually turn 0).
 const signature=values.slice().sort((a,b)=>a-b).join(',');
 const bankKey=occupied.join(',')+'|'+signature+'|'+Boolean(falling)+'|'+JSON.stringify(target||false);
 for(const o of [shuffleBank[bankKey],...fallbacks]){if(!o?.solution||o.board.some((v,i)=>!!v!==!!board[i])||o.board.filter(Boolean).sort((a,b)=>a-b).join(',')!==signature)continue;
 const cost=shuffleScore(o.board,occupied,limits,pairs(o.board).length);if(cost>=bestScore)continue;
 let b=o.board.slice(),n=moves;for(const [a,c]of o.solution){b=remove(b,a,c,mask,falling);if(!b||targetFailed(b,++n,target)){b=null;break;}}
 if(b&&!b.some(Boolean)){best={board:o.board.slice(),solution:o.solution.map(p=>p.slice())};bestScore=cost;}
 }
 // Even the emergency construction is dispersed by certified random trials.
 while(performance.now()-start<budget-8){const b=Array(56).fill(0),v=randomize(values,rng);occupied.forEach((i,j)=>b[i]=v[j]);const score=shuffleScore(b,occupied,limits,pairs(b).length);if(score>bestScore||!hint(b))continue;
 const s=solve(b,mask,falling,target,{timeout:Math.min(20,Math.max(1,budget-(performance.now()-start)-5)),moves});
 if(s.solution){best={board:b,solution:s.solution};bestScore=score;if(!score)return {...best,fallback:forceFallback};}}
 return {...best,fallback:true};
}

// Construction supplies are column queues: a full column leaves its head waiting.
export function supplyCount(queues){return queues.reduce((n,q)=>n+q.length,0);}
export function supply(board,queues,mask){
 const b=fall(board,mask),q=queues.map(c=>c.slice()),inserted=[];
 for(let x=0;x<W;x++){const cell=mask.find(i=>i%W===x&&!b[i]);if(cell!==undefined&&q[x].length){b[cell]=q[x].shift();inserted.push(cell);}}
 return {board:fall(b,mask),queues:q,inserted};
}
export function constructionWon(board,queues){return !board.some(Boolean)&&supplyCount(queues)===0;}
export function solveConstruction(board,queues,mask,tempo=1,{timeout=3000,falling=true,target=false,moves=0}={}){
 const deadline=performance.now()+timeout,dead=new Set();let timedOut=false,nodes=0;
 function dfs(b,q,n){nodes++;if(targetFailed([...b,...q.flat()],n,target))return null;if(performance.now()>deadline){timedOut=true;return null;}
 if(constructionWon(b,q))return [];
 if(!b.some(Boolean)){const r=supply(b,q,mask);return dfs(r.board,r.queues,n);}
 const key=b.join(',')+'|'+q.map(c=>c.join(',')).join(';')+'|'+(target?n:n%tempo);if(dead.has(key))return null;
 const ps=pairs(b);if(target)ps.sort((a,c)=>(b[c[0]]===target.person)-(b[a[0]]===target.person));
 for(const [a,c] of ps){let next=remove(b,a,c,mask,falling),nextQ=q;if((n+1)%tempo===0||!next.some(Boolean)){const r=supply(next,q,mask);next=r.board;nextQ=r.queues;}const tail=dfs(next,nextQ,n+1);if(tail)return [[a,c],...tail];if(timedOut)return null;}dead.add(key);return null;
 }return {solution:dfs(board,queues,moves),timedOut,nodes};
}
// Supplies may temporarily leave odd counts on the board. Preserve every token;
// make available pairs adjacent without touching any queued timber.
export function shuffleConstruction(board,mask,rng=Math.random,context=null){
 const cells=board.flatMap((v,i)=>v?[i]:[]);
 return dispersedShuffle(board,cells,o=>pairs(o.board),rng,context?(o,timeout)=>solveConstruction(o.board,context.queues,mask,2,{timeout,falling:context.level.falling,target:context.level.target,moves:context.moves||0}).solution:null);
}

// Third chapter: layers retain only cells that were empty when surrounded.
export function newSiege(level){return {layers:[],advances:0,skills:level.id===10?2:1};}
export function siegeMask(mask,s){const blocked=new Set(s.layers.flat());return mask.filter(i=>!blocked.has(i));}
export function siegePairs(board,s){const out=[];for(let a=0;a<56;a++)if(board[a])for(let b=a+1;b<56;b++)if(board[a]===board[b]&&linkable(board,a,b,s))out.push([a,b]);return out;}
export function siegeTargetFailed(board,s,level){return level.id===10&&s.advances>=3&&board.includes(10);}
export function advanceSiege(board,s,limit=5){
 if(s.layers.length>=limit)return s;
 const depth=s.layers.length-1,ring=depth<0?[]:board.flatMap((v,i)=>!v&&Math.min(i%7,6-i%7,i/7|0,7-(i/7|0))===depth?[i]:[]);
 return {...s,advances:s.advances+1,layers:[...s.layers,ring]};
}
export function breakSiege(s){if(!s.skills||!s.layers.length)return null;return {...s,skills:s.skills-1,layers:s.layers.slice(0,-1)};}
export function removeSiege(board,a,b,level,s){if(!path(board,a,b,false,s))return null;const out=board.slice();out[a]=out[b]=0;return level.falling?fallSiege(out,level.mask,s):out;}
export function fallSiege(board,mask,s){
 const blocked=new Set(s.layers.flat()),out=board.slice();
 for(let x=0;x<7;x++){let segment=[];const flush=()=>{const values=segment.map(i=>out[i]).filter(Boolean);segment.forEach((i,n)=>out[i]=values[n-segment.length+values.length]||0);segment=[];};for(let y=0;y<8;y++){const i=y*7+x;if(!mask.includes(i)||blocked.has(i))flush();else segment.push(i);}flush();}return out;
}
export function supplySiege(board,queues,mask,s){
 let b=fallSiege(board,mask,s);const q=queues.map(c=>c.slice()),inserted=[];
 for(let x=0;x<7;x++){const top=mask.find(i=>i%7===x);if(top===undefined)continue;for(let y=top/7|0;y<8;y++){const i=y*7+x;if(!mask.includes(i)||s.layers.some(r=>r.includes(i))||b[i])break;if(q[x].length){b[i]=q[x].shift();inserted.push(i);break;}}}
 return {board:fallSiege(b,mask,s),queues:q,inserted};
}
// Shuffle only occupied, unblocked cells. No fence is ever removed automatically.
export function shuffleSiege(board,s,rng=Math.random,context=null){
 const cells=board.flatMap((v,i)=>v?[i]:[]);
 return dispersedShuffle(board,cells,o=>siegePairs(o.board,s),rng,context?(o,timeout)=>solveSiege(o.board,context.queues,context.level,2,{timeout,siege:s,moves:context.moves||0}).solution:null,s);
}

export function siegeDeadlock(board,s){return siegePairs(board,s).length?'play':s.skills?'skill':'lost';}
export function solveSiege(board,queues,level,tempo,{timeout=1000,siege=newSiege(level),moves=0}={}){
 const deadline=performance.now()+timeout,dead=new Set();let timedOut=false,nodes=0;
 function dfs(b,q,s,n){nodes++;if(performance.now()>deadline){timedOut=true;return null;}if(siegeTargetFailed(b,s,level))return null;if(constructionWon(b,q))return [];
 const key=b+'|'+JSON.stringify(q)+'|'+JSON.stringify(s.layers)+'|'+s.advances+'|'+n%tempo;if(dead.has(key))return null;
 let ps=siegePairs(b,s);if(level.id===10&&b.includes(10))ps.sort((a,c)=>(b[c[0]]===10)-(b[a[0]]===10));
 for(const [a,c]of ps){let next=removeSiege(b,a,c,level,s),nq=q,ns=s;
 if(level.construction&&((n+1)%tempo===0||!next.some(Boolean))){const r=supplySiege(next,q,level.mask,s);next=r.board;nq=r.queues;}
 if((n+1)%tempo===0)ns=advanceSiege(next,s,level.siegeLimit);
 const tail=dfs(next,nq,ns,n+1);if(tail)return [[a,c],...tail];if(timedOut)return null;
 }dead.add(key);return null;
 }const solution=dfs(board,queues,siege,moves);return {solution,timedOut,nodes};
}
