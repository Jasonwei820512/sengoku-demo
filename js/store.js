// Non-consumable permanent entitlement. Replace this adapter with StoreKit at iOS packaging.
export const DEMO=true;
const KEY='sengoku-store-v1',RECEIPT='sengoku-mock-receipt';
export function isUnlocked(){try{return DEMO||localStorage.getItem(KEY)==='unlocked';}catch{return DEMO;}}
export async function getPrice(){return DEMO?'体験版：全編解放済み':'価格はApp Storeで表示（Webテスト）';}
export async function purchase(){localStorage.setItem(RECEIPT,'purchased');localStorage.setItem(KEY,'unlocked');return true;}
export async function restore(){if(DEMO||localStorage.getItem(RECEIPT)==='purchased'){localStorage.setItem(KEY,'unlocked');return true;}return false;}
