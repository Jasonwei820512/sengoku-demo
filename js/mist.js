import {W,linkable,fall,dispersedShuffle} from './rules.js';
import {duelFailed} from './ambush.js';

export function mistDistance(x,y,corners){
 return Math.min(...corners.map(corner=>Math.hypot(x-corner,y)));
}

// Each row starts at its source corner. Keep the closest cells first so
// removing a suffix retreats toward the nearest source, including for two corners.
export function makeMist(corners,rows,step){
 const cells=new Set();
 for(const corner of corners){
  rows.forEach((width,y)=>{
   for(let x=0;x<width;x++)cells.add(y*W+(corner===0?x:W-1-x));
  });
 }
 const distance=i=>mistDistance(i%W,i/W|0,corners);
 return {corners,step,cells:[...cells].sort((a,b)=>distance(a)-distance(b)||a-b)};
}

export function retreatMist(mist,rule){
 return mist.slice(0,Math.max(0,mist.length-rule.step));
}

export function validMist(mist,rule){
 if(!Array.isArray(mist))return false;
 if(!rule)return mist.length===0;
 return mist.length<=rule.cells.length &&
  (!mist.length||(rule.cells.length-mist.length)%rule.step===0) &&
  mist.every((cell,i)=>cell===rule.cells[i]);
}

export function mistPairs(board,mist,first=false){
 const covered=mist.length?new Set(mist):null;
 const candidates=board.flatMap((value,i)=>value&&!covered?.has(i)?[i]:[]);
 const pairs=[];
 for(let a=0;a<candidates.length;a++){
  const i=candidates[a];
  for(let b=a+1;b<candidates.length;b++){
   const j=candidates[b];
   if(board[i]===board[j]&&linkable(board,i,j,null,covered)){
    pairs.push([i,j]);
    if(first)return pairs;
   }
  }
 }
 return pairs;
}

export function mistMatch(board,mist,a,b,level){
 const next=board.slice();
 next[a]=next[b]=0;
 return {board:level.falling?fall(next,level.mask):next,mist:retreatMist(mist,level.mist)};
}

export function rescueMist(board,mist,rule){
 const before=mist;
 if(board.some(Boolean)){
  while(mist.length&&!mistPairs(board,mist,true).length)mist=retreatMist(mist,rule);
 }
 return {mist,triggered:mist!==before};
}

export function solveMist(board,mist,level,{openingOnly=false,timeout=120,limit=6000,rejected}={}){
 const deadline=performance.now()+timeout;
 // Falling uses original token identities so a newly uncovered token cannot
 // count toward the opening guarantee, even if it shares a portrait.
 const original=openingOnly?board.map((v,i)=>v?(mist.includes(i)?-1:1):0):null;
 const dead=new Set();
 let nodes=0;
 function search(b,m,eligible){
  if(duelFailed(b,level))return null;
  if(!b.some(Boolean))return [];
  if(++nodes>limit||performance.now()>deadline)return null;
  const key=b.join()+':'+m.length+(m.length&&eligible?':'+eligible.join():'');
  if(dead.has(key))return null;
  const ps=mistPairs(b,m);
  if(level.duel)ps.sort((a,c)=>(b[c[0]]===9)-(b[a[0]]===9));
  for(const pair of ps){
   if(nodes===1&&rejected?.has(pair.join()))continue;
   const [a,c]=pair;
   if(m.length&&eligible&&(eligible[a]!==1||eligible[c]!==1))continue;
   const next=mistMatch(b,m,a,c,level);
   const nextEligible=m.length&&eligible?mistMatch(eligible,m,a,c,level).board:null;
   const tail=search(next.board,next.mist,nextEligible);
   if(tail)return [pair,...tail];
   if(nodes>limit||performance.now()>deadline)return null;
  }
  dead.add(key);
  return null;
 }
 return search(board,mist,original);
}

export function shuffleMist(board,mist,level,rng=Math.random){
 const visible=board.flatMap((v,i)=>v&&!mist.includes(i)?[i]:[]);
 return dispersedShuffle(board,visible,o=>mistPairs(o.board,mist),rng,
  (o,timeout)=>solveMist(o.board,mist,level,{timeout}));
}
