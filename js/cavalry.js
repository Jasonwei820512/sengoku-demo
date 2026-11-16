// Compact only the removed tokens' rows, preserving order and mask holes.
// Fences split rows into independent segments; they are never crossed.
export function squeezeLeft(board,mask,rows,siege=null){
 const out=board.slice(),allowed=new Set(mask),blocked=new Set(siege?.layers.flat()||[]);
 for(const y of new Set(rows)){let cells=[];const flush=()=>{const values=cells.map(i=>out[i]).filter(Boolean);cells.forEach((i,n)=>out[i]=values[n]||0);cells=[];};
 for(let x=0;x<7;x++){const i=y*7+x;if(blocked.has(i)){flush();continue;}if(allowed.has(i))cells.push(i);}flush();}
 return out;
}
