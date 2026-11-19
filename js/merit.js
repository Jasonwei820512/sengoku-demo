// Cosmetic-only economy. One atomic record contains wallet, unlocks and first clears.
export const MERIT_KEY='sengoku-merit-v1';
export const GOODS=[
 ['ivory','象牙','skin',0],['wood','黄楊','skin',300],['jade','翡翠','skin',650],['lacquer','漆黒蒔絵','skin',1200],['sakura','桜','skin',1800],['gold','金箔','skin',7200],
 ['plain','なし','board',0],['paper','和紙','board',200],['tatami','畳','board',300],['waves','青海波','board',400],
 ['goldcrest','金','crest',0],['silver','銀','crest',200],['red','朱','crest',200]
].map(([id,name,kind,price])=>({id,name,kind,price}));
export const FUTURE_COSMETICS=['illustration','music','portraitAge'];
export function readMerit(storage){let s;try{s=JSON.parse(storage.getItem(MERIT_KEY));}catch{}const owned=GOODS.filter(g=>!g.price||(Array.isArray(s?.owned)&&s.owned.includes(g.id))).map(g=>g.id);const selected={skin:'ivory',board:'plain',crest:'goldcrest'};for(const k of Object.keys(selected))if(GOODS.some(g=>g.kind===k&&g.id===s?.selected?.[k]&&owned.includes(g.id)))selected[k]=s.selected[k];return {balance:Number.isSafeInteger(s?.balance)&&s.balance>=0?s.balance:0,owned,selected,clears:Array.isArray(s?.clears)?s.clears.filter(v=>/^([1-8])-([1-9]|10)$/.test(v)):[]};}
export function meritBreakdown({win,remaining,time,maxCombo,usedHint,first,relaxed=false,leftovers=null}){if(!win)return [];return [['クリア',50],...(!relaxed?[['残り時間ボーナス',Math.floor(30*Math.max(0,Math.min(1,remaining/time||0)))]]:[]),['連撃ボーナス',Math.min(20,Math.max(0,Math.floor(maxCombo)||0)*2)],['ノーヒントボーナス',usedHint?0:15],['初クリアボーナス',first?20:0],...(leftovers===null?[]:[['残り計略ボーナス',30*leftovers]])];}
export function awardMerit(storage,key,stats,legacyCleared=false,{once=false}={}){const s=readMerit(storage),claimed=s.clears.includes(key);if(once&&claimed)return {state:s,rows:[],total:0};const first=!legacyCleared&&!claimed,rows=meritBreakdown({...stats,first}),total=rows.reduce((a,r)=>a+r[1],0);if(stats.win){s.balance+=total;if(!s.clears.includes(key))s.clears.push(key);storage.setItem(MERIT_KEY,JSON.stringify(s));}return {state:s,rows,total};}
export function redeemMerit(storage,id){const s=readMerit(storage),g=GOODS.find(g=>g.id===id);if(!g)return false;if(!s.owned.includes(id)){if(s.balance<g.price)return false;s.balance-=g.price;s.owned.push(id);}s.selected[g.kind]=id;storage.setItem(MERIT_KEY,JSON.stringify(s));return s;}
