// Non-consumable permanent entitlement. Replace this adapter with StoreKit at iOS packaging.
export const DEMO=false;
const previewAll=typeof location!=='undefined'&&new URLSearchParams(location.search).has('all');
const demoPrefix=typeof location!=='undefined'&&new URLSearchParams(location.search).has('demo')?'demo:':'';
const KEY=demoPrefix+'sengoku-store-v1',RECEIPT=demoPrefix+'sengoku-mock-receipt';
export function isUnlocked(){try{return DEMO||previewAll||localStorage.getItem(KEY)==='unlocked';}catch{return DEMO;}}
export async function getPrice(translate=key=>key==='store.preview'?'Preview: Full game unlocked':'See the App Store for pricing (web test)'){return translate(DEMO?'store.preview':'store.webPrice');}
export async function purchase(){localStorage.setItem(RECEIPT,'purchased');localStorage.setItem(KEY,'unlocked');return true;}
export async function restore(){if(DEMO||localStorage.getItem(RECEIPT)==='purchased'){localStorage.setItem(KEY,'unlocked');return true;}return false;}
