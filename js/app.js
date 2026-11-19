import {languages,initialLanguage,loadMessages,createI18n} from './i18n.js';
import {STRATEGY_POOL,openingStrategy,strategyCount,strategyTargets,battleStars,validStrategyRun} from './strategy.js';
import {GOODS,readMerit,awardMerit,redeemMerit} from './merit.js';
import * as store from './store.js';
import {bombard,innerRoute} from './artillery.js';
let shot=0,artilleryDue=0;
import {betray} from './betrayal.js';
let betrayalLeft=0;
import {newFire,tickFire,fireMatch,firePairs,shuffleFire} from './fire.js';
let fire=null;
import {squeezeLeft} from './cavalry.js';
import {fogPairs,removeFogTiles,fogSupply,shuffleFog,duelFailed} from './fog.js';
import {createMusic} from './music.js';
import {weather,setWeather} from './weather.js';
import {createLinkFx} from './linkfx.js';
let linkFx;
import {newSiege,advanceSiege,breakSiege,siegePairs,siegeTargetFailed,fallSiege,supplySiege,shuffleSiege,siegeDeadlock,path,hint,fall,shuffle,targetFailed,supply,supplyCount,constructionWon,shuffleConstruction} from './rules.js';
export const UNLOCK_ALL=false;
const previewAll=!store.isIOS&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('all');
const demoMode=!store.isIOS&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('demo');
const demoPrefix=demoMode?'demo:':'';
const gameStorage=store.isIOS?store.nativeStorage:{
 getItem:key=>localStorage.getItem(demoPrefix+key),
 setItem:(key,value)=>localStorage.setItem(demoPrefix+key,value),
 removeItem:key=>localStorage.removeItem(demoPrefix+key)
};
const storageKeys=()=>store.isIOS?gameStorage.keys():Object.keys(localStorage).filter(key=>key.startsWith(demoPrefix)).map(key=>key.slice(demoPrefix.length));
if(store.isIOS){
 document.documentElement.classList.add('native-ios');
 await gameStorage.load();
 await store.initialize();
}
let demoHeldAt=null,demoPausedFor=0,demoFreeShuffles=0,demoResult=null;
const battleNow=()=>demoMode?(demoHeldAt??performance.now())-demoPausedFor:performance.now();
const chapters=new Map(),musicByChapter={1:{normal:'bgm_ch1',boss:'bgm_ch1_boss'}};
let chapter=1,queues=Array.from({length:7},()=>[]),supplyDue=0,nextTileId=10000;
let fog=[];
let siege=null,siegeDue=0;
const availablePairs=()=>level?.siege?siegePairs(board,siege):null;
const currentHint=()=>(level?.fire||level?.noOuter)?firePairs(board,ids,fire,fog,siege).find(([a,b])=>![...fire.active,...fire.events.filter((e,k)=>!fire.fired.includes(k))].some(e=>e.ids.includes(ids[a])!==e.ids.includes(ids[b]))):(level?.fog||level?.left)?fogPairs(board,fog,siege)[0]:level?.siege?availablePairs()[0]:hint(board);
const chapterLabel=()=>tr('chapterLabel.'+chapter);
const i18n=createI18n(),{t:tr}=i18n;
const $=s=>document.querySelector(s),app=$('#app');
let data,text={},progress={stars:Array(10).fill(0),intro:false},level,board,ids=[],selected=-1,history=[],moves=0,combo=0,maxCombo=0,lastMatch=0,remaining=0,started=0,paused=false,busy=false,screen='',muted=false,run=0,usedHint=false;
const sounds={select:'s1',clear:'s2',bad:'s3',hint:'s4',coin:'s4',shuffle:'s5',win:'s6',start:'s7',lose:'s8',two:'s9',many:'s10'};
const music=createMusic(),effectMusic=createMusic();
document.addEventListener('visibilitychange',()=>{music.visibility();effectMusic.visibility();if(document.hidden)for(const a of Object.values(audio))a.pause();});
const audio={};for(const [k,v]of Object.entries(sounds)){audio[k]=new Audio();audio[k].preload='none';audio[k].soundSrc='sfx/'+v+'.mp3';}
audio.timber=new Audio();audio.timber.preload='none';audio.timber.soundSrc='sfx/'+sounds.two+'.mp3';audio.timber.volume=.14;
function sound(k){if(muted||!settings.sfxEnabled||settings.sfx<=0)return;const a=audio[k];if(!a.src)a.src=a.soundSrc;a.volume=settings.sfx*(k==='timber'?.14:k==='coin'?.18:1);a.currentTime=0;a.play().catch(()=>{});if(!store.isIOS&&k==='select'&&settings.vibration&&typeof navigator!=='undefined')navigator.vibrate?.(8);}
document.addEventListener('click',e=>{if(e.target?.closest?.('button')&&!e.target.closest('.tile'))sound('select');});
function save(){try{gameStorage.setItem(`sengoku-ch${chapter}-v1`,JSON.stringify(progress));return true;}catch{toast(tr('couldNotSaveProgress'));return false;}}
function settleBattleMerit(chapter, record){
 let reward;
 // Progress, inventory and the pending award share one save. The wallet
 // records the battle key so an interrupted payout can safely be retried.
 while(record.pendingMerit?.length){
  const {id,stats}=record.pendingMerit[0];
  reward=awardMerit(gameStorage,`${chapter}-${id}`,stats,false,{once:true});
  record.pendingMerit.shift();
 }
 return reward;
}
try{const p=JSON.parse(gameStorage.getItem('sengoku-ch1-v1'));if(p&&Array.isArray(p.stars))progress={stars:Array.from({length:10},(_,i)=>Math.min(3,Math.max(0,Number(p.stars[i])||0))),intro:!!p.intro};}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function person(v){return text.people?.[data.names[v-1]]||{};}function short(v){return person(v).short||[tr('nobunaga'),tr('nohime'),tr('hideyoshi'),tr('toshiie'),tr('katsuie'),tr('nagahide'),tr('shinsuke'),tr('oichi'),tr('yoshimoto'),tr('motoyasu'),tr('asahina'),tr('naomori'),tr('munenobu'),tr('naotora')][v-1];}
function portrait(v){if(data.portraits)return data.portraits[v-1];return 'portraits/ch1/'+data.names[v-1]+'.png';}
function targetSpec(t=level.target){return t===true?{person:9,beforePairs:14}:t;}
function targetRule(t=level.target){const x=targetSpec(t);return tr('clearAllOfSTilesByThe', [x.beforePairs, short(x.person)]);}
function formation(l){return text.formations?.[l.formation]||{};}
function fname(l){return formation(l).name||tr('genericFormation',[l.formation]);}
function toast(t){$('#toast').textContent=t;$('#toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.opacity=0,2200);}
function weatherEmptyCells(){const root=$('.board');if(!root||!board)return [];const rect=root.getBoundingClientRect(),{w,h,gap}=geometry();return board.flatMap((v,i)=>v?[]:[{id:i,x:rect.left+(i%7)*(w+gap)+w/2,y:rect.top+Math.floor(i/7)*(h+gap)+h/2}]);}
function view(html,cls=''){applyCosmetics();document.body.dataset.chapter=chapter;document.body.style.setProperty('--chapter-intro',`url('img/ch${chapter}_intro.jpg'),url('img/ch${Math.max(1,chapter-1)}_intro.jpg'),url('img/ch1_intro.jpg')`);music.stop();effectMusic.stop();music.pause(false);effectMusic.pause(false);weather({battle:cls==='game',paused:false,boss:level?.id===10,silent:muted||!settings.sfxEnabled,chapter,effect:level?.weather?.type,fade:level?.weather?.fade,count:level?.weather?.count,volume:settings.sfx,progress:()=>1-seconds()/level.time,emptyCells:weatherEmptyCells});linkFx?.dispose();linkFx=undefined;run++;screen=cls.split(' ')[0];busy=false;app.innerHTML=`<main class="screen ${cls}">${html}</main>`;scrollTo(0,0);}
// 名鑑 uses stable portrait keys, shared across all chapter-local person numbers.
let catalog={people:[],chapters:[]},collected=new Set(),catalogChapter=Number(readJSON('sengoku-catalog-chapter',1))||1;
const CATALOG_KEY='sengoku-catalog-v1';
function loadCollection(){collected=new Set();try{const saved=JSON.parse(gameStorage.getItem(CATALOG_KEY));if(Array.isArray(saved?.people))collected=new Set(saved.people.filter(id=>catalog.people.some(p=>p.id===id)));}catch{collected=new Set();}}
function collectDebut(d=data,l=level){let changed=false;for(const v of l.debut){const id=d.names[v-1];if(catalog.people.some(p=>p.id===id)&&!collected.has(id)){collected.add(id);changed=true;}}if(changed)try{gameStorage.setItem('sengoku-unread','1');gameStorage.setItem(CATALOG_KEY,JSON.stringify({version:1,people:[...collected]}));}catch{toast(tr('couldNotSaveTheRoster'));}}
const catalogCount=()=>`${collected.size}/${catalog.people.length}`;
const catalogPerson=id=>catalog.people.find(p=>p.id===id);
function catalogTile(p){
 const known=collected.has(p.id);
 const name=known?esc(p.name).replace(/（[^（）]+）$/, '<span class="catalog-alias">$&</span>'):'？？？';
 return `<button class="catalog-item" data-person="${esc(p.id)}" aria-label="${known?esc(p.name):tr('undiscoveredWarrior')}"><span class="catalog-portrait pc ${known?esc(p.faction):'unknown'}"><img loading="lazy" src="${esc(p.image)}" alt="" ${known?'':'class="silhouette"'}></span><span class="catalog-name">${name}</span></button>`;
}
function collection(){gameStorage.setItem('sengoku-collection-tab','people');gameStorage.removeItem('sengoku-unread');const groups=catalog.chapters.filter(c=>c.id===catalogChapter);view(`<header class="toolbar"><h2>${tr('collection')}</h2><button id="catalog-close">${tr('close')}</button></header><nav class="catalog-tabs" aria-label="${tr('collection')}"><button aria-current="page" id="warrior-tab">${tr('warriors')}</button><button id="art-tab">${tr('art')}</button><button id="formation-tab">${tr('formation')}</button><button id="music-tab">${tr('music')}</button></nav><div class="catalog-progress">${tr('warriorRoster')}<b>${catalogCount()}</b><small>${tr('warriorsAreAddedWhenTheyFirstAppear')}</small></div><label class="catalog-filter">${tr('firstAppearance')}<button id="catalog-chapter">${tr('catalogChapterPicker', [catalogChapter])}</button></label>${groups.map(c=>{const ps=catalog.people.filter(p=>p.firstChapter===c.id);return `<section><h3>${tr('catalogChapterHeading', [c.id, esc(chapterName(c.id))])}<small>${ps.filter(p=>collected.has(p.id)).length}/${ps.length}</small></h3><div class="catalog-grid">${ps.map(catalogTile).join('')}</div></section>`;}).join('')}`,'collection paged');$('#catalog-close').onclick=()=>settingsPage('data');$('#art-tab').onclick=()=>extraCollection('art');$('#music-tab').onclick=()=>extraCollection('music');$('#warrior-tab').onclick=collection;$('#formation-tab').onclick=formationCollection;$('#catalog-chapter').onclick=()=>choiceDialog(tr('firstAppearanceSection'),catalog.chapters.map(c=>[c.id,tr('chapterHeading',[c.id, chapterName(c.id)])]),v=>{catalogChapter=Number(v);gameStorage.setItem('sengoku-catalog-chapter',JSON.stringify(catalogChapter));collection();});document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{if(collected.has(b.dataset.person))personPage(b.dataset.person);else toast(tr('youHavenTMetThisWarriorYet'));});}
function pager(key,count){let index=Number(readJSON('sengoku-page-'+key,0));if(!Number.isInteger(index)||index<0||index>=count)index=0;return {index,html:`<nav class="btn-row pager"><button id="page-prev" ${index===0?'disabled':''}>${tr('previous')}</button><span>${index+1} / ${count}</span><button id="page-next" ${index===count-1?'disabled':''}>${tr('next')}</button></nav>`,bind(render){for(const [id,delta] of [['page-prev',-1],['page-next',1]])$('#'+id).onclick=()=>{gameStorage.setItem('sengoku-page-'+key,JSON.stringify(index+delta));render();};}};}
function formationCollection(){gameStorage.removeItem('sengoku-unread');gameStorage.setItem('sengoku-collection-tab','formations');const forms=new Map();for(const c of chapters.values())for(const l of c.data.levels)if(!forms.has(l.formation))forms.set(l.formation,{level:l,info:c.text.formations?.[l.formation]||{}});const page=pager('formations',forms.size);view(`<header class="toolbar"><h2>${tr('collection')}</h2><button id="catalog-close">${tr('close')}</button></header><nav class="catalog-tabs" aria-label="${tr('collection')}"><button id="warrior-tab">${tr('warriors')}</button><button id="art-tab">${tr('art')}</button><button aria-current="page" id="formation-tab">${tr('formation')}</button><button id="music-tab">${tr('music')}</button></nav><p class="muted">${tr('theseFormationsShowRepresentativeBattleLayouts')}</p>${page.html}${[...forms].slice(page.index,page.index+1).map(([name,{level:l,info:f}])=>`<section class="catalog-formation"><h3>${esc(f.name||tr('genericFormation',[name]))}</h3>${activeLanguage==='ja'?`<div class="muted">${esc(f.kana||'')}</div>`:''}${mini(l)}<p>${esc(f.intro||tr('positionYourTroopsToAttackAndDefend'))}</p></section>`).join('')}`,'collection paged');page.bind(formationCollection);$('#catalog-close').onclick=()=>settingsPage('data');$('#art-tab').onclick=()=>extraCollection('art');$('#music-tab').onclick=()=>extraCollection('music');$('#warrior-tab').onclick=collection;$('#formation-tab').onclick=formationCollection;}

function openCollection(){const tab=gameStorage.getItem('sengoku-collection-tab');if(tab==='formations')formationCollection();else if(tab==='art'||tab==='music')extraCollection(tab);else collection();}
function personPage(id,tab){const choices=[['impression',tr('profile')],['reality',tr('history')],['anecdote',tr('talesTies')]];tab=savedTab('person',choices,tab);const p=catalogPerson(id);if(!p||!collected.has(id))return;view(`<header class="toolbar"><button id="catalog-back">${tr('backToRoster')}</button><span class="eyebrow">${tr('warriorRosterCount', [catalogCount()])}</span></header><article class="catalog-detail"><div class="catalog-hero pc ${esc(p.faction)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>${activeLanguage==='ja'?`<p class="catalog-kana">${esc(p.kana)}</p>`:''}<h1>${esc(p.name)}</h1><p>${esc(p.years)}<br><span class="catalog-crest pc ${esc(p.faction)}" role="img" aria-label="${esc(p.crest)}"></span> ${esc(p.family)}　${esc(p.crest)}</p><p class="catalog-epithet">${esc(p.epithet)}</p>${pageTab('person',choices,tab)}<div class="catalog-bio"><p>${esc(p.bio[tab])}</p></div>${tab==='anecdote'?'<h3>'+tr('ties')+'</h3>':''}<div class="catalog-bonds">${(tab==='anecdote'?p.bonds:[]).map(b=>{const other=catalogPerson(b.person),known=collected.has(b.person);return `<button data-bond="${esc(b.person)}" ${known?'':'disabled'}>${esc(b.type)}：${known?esc(other.name):tr('undiscovered')}</button>`;}).join('')}</div><p class="muted">${tr('firstAppearanceChapterBattle', [p.firstChapter, p.firstLevel])}<br>${tr('factionAndCrestReflectTheChapterOf')}</p></article>`,'collection paged person-detail');bindPageTabs('person',t=>personPage(id,t));$('#catalog-back').onclick=collection;document.querySelectorAll('[data-bond]').forEach(b=>b.onclick=()=>personPage(b.dataset.bond));}


let worldMap={provinces:[],levels:[],chapters:[],viewBox:'-190 0 610 605'};
function mapEntry(c=chapter,l=level?.id){return worldMap.levels.find(v=>v.chapter===c&&v.level===l);}
function conquered(){return new Set(worldMap.levels.filter(v=>chapters.get(v.chapter)?.progress.stars[v.level-1]>0).map(v=>v.province).filter(Boolean));}
function unified(){return chapters.size===8&&[...chapters.values()].every(c=>c.progress.stars.every(Boolean));}
let recentOccupation=null;
const mapFaction=c=>c===4?'takeda':c===6?'akechi':c===7?'tokugawa':c===8?'toyotomi':'oda';
function occupationSound(){const token=run;setTimeout(()=>{if(run===token)sound('select');},600);}
function mapSVG(focus='',highlight='province-highlight',showChapters=false){
 const owned=conquered(),faction=mapFaction(recentOccupation?.province===focus?recentOccupation.chapter:chapter);
 const chapterProvinces=new Set(showChapters?worldMap.chapters.map(c=>c.province):[]);
 const ordinary=[],chapterBorders=[],focused=[];
 for(const p of worldMap.provinces){
  const isFocus=p.id===focus, isChapter=chapterProvinces.has(p.id);
  const classes=['province'];
  if(owned.has(p.id))classes.push('owned');
  if(isFocus)classes.push(highlight);
  else if(isChapter)classes.push('chapter-border');
  const paths=isFocus?focused:isChapter?chapterBorders:ordinary;
  paths.push(`<path class="${classes.join(' ')}" d="${p.d}"><title>${esc(provinceName(p.id))}${owned.has(p.id)?tr('conquered'):''}</title></path>`);
 }
 return `<svg class="province-map ${faction}" viewBox="${worldMap.viewBox}" role="img" aria-label="${tr('mapOfTheProvinces', [focus?tr('message67')+esc(provinceName(focus)):''])}"><image href="img/map_japan.svg" x="-190" y="0" width="610" height="605"/>${ordinary.join('')}${chapterBorders.join('')}${focused.join('')}${worldMap.provinces.map(p=>`<text class="province-label" x="${p.x}" y="${p.y+3}">${esc(provinceName(p.id))}</text>`).join('')}</svg>`;
}
function mapLocation(){
 const battlefield=mapEntry()?.province;
 const base=worldMap.chapters.find(c=>c.id===chapter)?.province||battlefield;
 const p=worldMap.provinces.find(p=>p.id===base);
 if(!p)return '';
 const focus=battlefield||base;
 return `<button id="mini-map" class="map-location" aria-label="${tr('openTheUnificationMapToLocate', [esc(provinceName(focus))])}"><span class="mini-map-art">${mapSVG(focus,'battlefield-pulse')}</span><span>${tr('headquarters')}<b>${tr('province', [esc(provinceName(p.id))])}</b></span></button>`;
}
function victoryStamp(){return `<div class="victory-stamp" role="img" aria-label="${tr('win')}"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><filter id="seal-ink"><feTurbulence type="fractalNoise" baseFrequency=".19" numOctaves="3" seed="8" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8"/></filter></defs><g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="square" filter="url(#seal-ink)"><path stroke-width="5" d="M10 9L110 11 109 110 9 108Z"/><path stroke-width="2" d="M16 16H103V103H16Z"/><!-- Hand-cut square seal strokes for 勝: 月 + upper component + 力. --><path stroke-width="6" d="M25 94V27H46V92H38M26 46H45M26 65H45M57 26L63 37M87 26L81 37M54 43H96M56 55H96M73 37L65 57 53 68M79 44L90 62 98 67M56 72H91L88 93H78M72 61L69 78 58 94"/></g></svg></div>`;}

const MAP_MARKERS=[[80,67],[70,52],[45,42],[88,38],[88,80],[43,63],[56,79],[32,83]];
function selectChapter(){const owned=conquered();view(`<header class="toolbar"><h2>${tr('unificationMap')}</h2><button id="back">${tr('titleScreen')}</button></header><div class="map-summary">${tr('provincesBattles', [owned.size, [...chapters.values()].reduce((n,c)=>n+c.progress.stars.filter(Boolean).length,0)])}</div><div class="map-controls"><button id="map-minus" aria-label="${tr('zoomOut')}">−</button><button id="map-reset">${tr('reset')}</button><button id="map-plus" aria-label="${tr('zoomIn')}">＋</button></div><div class="map-viewport"><div class="map-canvas">${mapSVG(recentOccupation?.province||'','province-highlight',true)}<svg class="map-leaders" viewBox="-190 0 610 605" aria-hidden="true">${worldMap.chapters.map((c,i)=>{const p=worldMap.provinces.find(p=>p.id===c.province),pos=MAP_MARKERS[i];return `<path d="M${p.x},${p.y}L${pos[0]*6.1-190},${pos[1]*6.05}"/>`;}).join('')}</svg>${worldMap.chapters.map((c,i)=>{const pos=MAP_MARKERS[i];return `<button id="ch${c.id}" class="map-marker" style="left:${pos[0]}%;top:${pos[1]}%" aria-label="${tr('mapChapterLabel', [c.id, esc(chapterName(c.id))])}" ${!UNLOCK_ALL&&!previewAll&&c.id>1&&!chapters.get(c.id-1).progress.stars.every(Boolean)?'disabled':''}><span>${c.id}</span></button>`;}).join('')}</div></div><p class="map-help">${tr('tapAChapterToDeployTapTo')}</p><div class="map-chapters">${worldMap.chapters.map(c=>`<button data-map-chapter="${c.id}" ${!UNLOCK_ALL&&!previewAll&&c.id>1&&!chapters.get(c.id-1).progress.stars.every(Boolean)?'disabled':''}>${c.id}　${esc(chapterName(c.id))}</button>`).join('')}</div>${unified()?'<button id="unified" class="primary">'+tr('unificationRecord')+'</button>':''}<details class="map-credit"><summary>${tr('mapCredits')}</summary><p>${tr('sengokuEraProvincesExcludingIkiAndTsushima')}</p><a href="https://commons.wikimedia.org/wiki/File:Provinces_of_Japan.svg" target="_blank" rel="noopener">${tr('provincesOfJapanAshCrowOriginalBy')}</a> · <a href="https://creativecommons.org/licenses/by/2.5/" target="_blank" rel="noopener">CC BY 2.5</a><p>${tr('bordersExtractedColorsLayoutAndMapExtent')}</p></details>`,'world-map');for(const c of worldMap.chapters)$('#ch'+c.id).onclick=()=>chooseChapter(c.id);document.querySelectorAll('[data-map-chapter]').forEach(b=>b.onclick=()=>chooseChapter(+b.dataset.mapChapter));$('#back').onclick=title;if($('#unified'))$('#unified').onclick=ending;bindMap();if(recentOccupation)occupationSound();}
function bindMap(){const viewport=$('.map-viewport'),canvas=$('.map-canvas');let zoom=1,drag=null,moved=false;function scale(n){zoom=Math.max(1,Math.min(3,n));canvas.style.width=`${zoom*100}%`;}$('#map-plus').onclick=()=>scale(zoom+.5);$('#map-minus').onclick=()=>scale(zoom-.5);$('#map-reset').onclick=()=>{scale(1);viewport.scrollLeft=viewport.scrollTop=0;};viewport.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,l:viewport.scrollLeft,t:viewport.scrollTop};moved=false;};viewport.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>8){moved=true;viewport.setPointerCapture?.(e.pointerId);}if(moved){viewport.scrollLeft=drag.l-dx;viewport.scrollTop=drag.t-dy;}};viewport.onpointerup=viewport.onpointercancel=()=>{drag=null;};viewport.onclick=e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}};viewport.addEventListener?.('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);}
function chooseChapter(n){if(!UNLOCK_ALL&&!previewAll&&n>1&&!chapters.get(n-1).progress.stars.every(Boolean)){toast(tr('clearThePreviousChapterFirst'));return;}if(n>1&&!previewAll&&!store.isUnlocked()){unlockPage(()=>chooseChapter(n));return;}chapters.get(chapter).progress=progress;chapter=n;({data,text,progress}=chapters.get(n));selectLevel();}
function selectLevel(){view(`<div class="eyebrow">${chapterLabel()}</div><h2>${esc(text.chapter?.title||tr('battleOfOkehazama'))}</h2><div class="scroll"><div class="levels">${data.levels.map((l,i)=>`<button class="level" data-level="${i}" ${!UNLOCK_ALL&&!previewAll&&i>0&&!progress.stars[i-1]?'disabled':''}><strong>${i+1}</strong>　${esc(fname(l))}<br><span class="stars">${'★'.repeat(progress.stars[i])}${'☆'.repeat(3-progress.stars[i])}</span></button>`).join('')}</div></div><div class="btn-row"><button id="back">${tr('chapters')}</button><button id="intro">${tr('chapterStory')}</button></div>`);document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>enter(+b.dataset.level));$('#intro').onclick=()=>intro(selectLevel);$('#back').onclick=selectChapter;}
function intro(next){view(`<div class="eyebrow">${chapterLabel()}</div><h2>${esc(text.chapter?.title||tr('battleOfOkehazama'))}</h2><div class="muted">${esc(text.chapter?.year||tr('eiroku'))}</div><div class="introArt" role="img" aria-label="${tr('chapterArt.'+chapter)}"></div><div class="scroll"><p>${esc(text.chapter?.intro||tr('chapterStory99'))}</p></div><button class="primary" id="next">${tr('continue')}</button>`);$('#next').onclick=$('.introArt').onclick=()=>{progress.intro=true;save();next();};}
function enter(i){if(!UNLOCK_ALL&&!previewAll&&i>0&&!progress.stars[i-1])return;if(chapter>1&&!previewAll&&!store.isUnlocked()){unlockPage(()=>enter(i));return;}level=data.levels[i];deploy();}
function mini(l){const silhouette=l.initialMask||l.mask;return `<div class="formation" aria-label="${tr('formation')}">${Array.from({length:56},(_,i)=>`<i class="${silhouette.includes(i)?'':'empty'}"></i>`).join('')}</div>`;}
// 出阵卡片（2026-11-16 负责人定）：每关开打前只弹这一张。第 1 关带章节插画和故事；人物只给“牌＋名字”，不写介绍。
let strategyRun, armedStrategy=null, strategyFirstId=0;
const chapterStrategies=()=>({grants:progress.strategy?.grants??{},stock:progress.strategy?.stock??{}});
const heldCount=id=>strategyRun?.stock[id]||0;
const spentCount=id=>(strategyRun?.opening[id]||0)-heldCount(id);
const elapsedSeconds=()=>Math.max(0,level.time+15*spentCount('toki')-seconds());

function startStrategies(){
 const record=chapterStrategies();
 strategyRun=openingStrategy(record,chapter,level.id,settings.relaxed,!!progress.stars[level.id-1]);
 if(record.grants[level.id]!==strategyRun.grant){
  progress.strategy={...record,grants:{...record.grants,[level.id]:strategyRun.grant}};
  save();
 }
}
function handHTML(stock){
 const items=Object.keys(STRATEGY_POOL).filter(id=>stock[id]);
 return items.length?`<div class="strategy-hand">${tr('heldStratagems', [items.map(id=>`<span aria-label="${tr('message101', [tr('strategy.'+id), stock[id]])}">${icon(id)}×${stock[id]}</span>`).join('')])}</div>`:'';
}
function deploy(){collectDebut();const first=level.id===1,f=formation(level);
 view(`<div class="deploy"><div class="card">${meritCounter()}${mapLocation()}<nav class="deploy-tools"><button id="open-map">${tr('map')}</button><button id="open-camp">${tr('camp')}</button><button id="open-settings" class="gear" aria-label="${tr('settings')}">${tr('settings122', [icon('settings'), unread()?'<i class="red-dot"></i>':''])}</button></nav>${first?`<div class="art" role="img" aria-label="${tr('chapterArt.'+chapter)}"><div class="cap"><small>${esc(text.chapter?.year||tr('eiroku'))}</small><h1>${esc(text.chapter?.title||tr('battleOfOkehazama'))}</h1></div></div>`:''}
 <div class="head"><div class="no">${tr('deployBattleHeading', [chapterLabel(), level.id])}</div>${first?'':`<h2>${esc(fname(level))}</h2>`}</div>
 <div class="body">${first?`<p class="story">${esc(text.chapter?.intro||'')}</p>`:''}
  <div class="form">${mini(level)}<p>${first?`<b>${esc(fname(level))}</b>`:''}${esc(f.intro||'')}</p></div>
  ${handHTML(progress.stars[level.id-1]?(chapterStrategies().grants[level.id]?{[chapterStrategies().grants[level.id]]:1}:{}):chapterStrategies().stock)}
  ${level.noOuter?`<div class="rule">● ${esc(text.rules.artillery)}（${cadence(level.artilleryInterval)}${settings.relaxed?tr('moveUnit'):tr('secondUnit')}）</div>`:''}
  ${level.betrayal?`<div class="rule">${tr('matches', [esc(text.rules.betrayal), level.betrayal])}</div>`:''}
  ${level.fire?`<div class="rule">● ${esc(text.rules.fire)}${level.id===10?'<br>'+esc(text.rules.boss):''}</div>`:''}
  ${level.left?`<div class="rule">● ${esc(text.rules.left)}</div>`:''}
  ${level.falling?`<div class="rule">● ${esc(text.rules?.falling||tr('afterAMatchTilesAboveItDrop'))}</div>`:''}
  ${level.construction?`<div class="rule">● ${esc(text.rules?.construction||tr('clearTheBoardAndAllTimber'))}<br>${tr('resupplyEvery', [cadence(level.supplyInterval), settings.relaxed?tr('moveUnit'):tr('secondUnit'), level.id===10?esc(text.rules?.dawn||tr('finishBeforeDawn')):''])}</div>`:''}
  ${chapter===3&&level.id===1?`<div class="siege-preview" aria-label="${tr('siegePreview')}"><span>▣ ▣ ▣<br>▣ ▣ ▣</span><b>${tr('afterSec')}</b><span class="encircled">▣ ▣ ▣<br>▣ ▣ ▣</span><small>${tr('enemyBarricadesCloseInFromTheEdges')}<br>${tr('useBreakOutToRemoveALayer')}</small></div>`:''}
  ${level.siege?`<div class="rule">● ${esc(text.rules.siege)}<br>${tr('everyUpToLayersBreakOutUses', [cadence(level.siegeInterval), settings.relaxed?tr('moveUnit'):tr('secondUnit'), level.siegeLimit, level.id===10?2:1, level.id===10?esc(text.rules.boss):''])}</div>`:''}
  ${level.fog?`<div class="rule">● ${esc(text.rules.fog)}${level.duel?'<br>'+esc(text.rules.boss):''}</div>`:''}
  ${level.target?`<div class="rule">● ${esc(targetRule())}</div>`:''}
  ${chapter===1&&level.id===9?`<aside class="boss-preview"><img src="${portrait(9)}" alt="${tr('imagawaYoshimoto')}"><p><b>${tr('nextBattle')}</b><br>${tr('defeatYoshimotoFirstInTheNextBattle')}<br>${esc(targetRule(data.levels[9].target))}</p></aside>`:''}
  ${level.debut.length?`<div class="cast-t">${tr('debutHeading')}</div><div class="cast">${level.debut.map(v=>`<div class="pc${chapter>=3?' '+data.factions[v-1]:chapter===2?(v>=10?' saito':''):(v>=9?' ima':'')}"><div class="ph"><img src="${portrait(v)}" alt=""></div><div class="nm">${esc(short(v))}</div></div>`).join('')}</div>`:''}
 </div><div class="btns"><button id="back">${tr('back')}</button><button class="go" id="go">${tr('deploy')}</button></div></div></div>`,'center');$('#back').onclick=selectChapter;$('#open-map').onclick=selectChapter;$('#mini-map').onclick=selectChapter;$('#open-settings').onclick=settingsPage;$('#open-camp').onclick=campPage;$('#go').onclick=()=>tutorialIfNeeded(start);}
let tipKeys=new Set();
function start(saved){if(!saved?.strategyRun)startStrategies();else strategyRun=saved.strategyRun;armedStrategy=saved?.armedStrategy??null;strategyFirstId=saved?.strategyFirstId??0;if(demoMode)demoFreeShuffles=0;tipKeys=new Set();shot=0;artilleryDue=level.time-cadence(level.artilleryInterval);betrayalLeft=level.betrayal||0;fog=(level.fog||[]).slice();siege=level.siege?newSiege(level):level.noOuter?innerRoute:null;siegeDue=level.time-cadence(level.siegeInterval);const opening=level.boards[Math.random()*20|0];board=opening.board.map(v=>v||0);queues=(opening.queues||Array.from({length:7},()=>[])).map(q=>q.slice());supplyDue=level.time-cadence(level.supplyInterval);nextTileId=10000;ids=board.map((v,i)=>v?i+1:0);fire=(level.fire||level.noOuter)?tickFire(newFire(opening.events||[]),ids,0).state:null;history=[];moves=0;combo=0;maxCombo=0;lastMatch=0;remaining=level.time;started=battleNow();paused=false;selected=-1;usedHint=false;view(`<header class="hud"><div class="toolbar"><span class="battle-position">${chapterLabel()}　${esc(chapterName(chapter))}<strong>${level.id} / ${data.levels.length}</strong></span><div><button id="power" aria-label="${tr('toggleWeatherEffects')}"></button> <button id="mute" aria-label="${tr('toggleSound')}">${muted?tr('muted'):tr('sound')}</button> <button id="pause" aria-label="${tr('paused')}">Ⅱ</button></div></div><h2>${esc(fname(level))}</h2><div class="status">${settings.relaxed?tr('relaxedMode'):tr('timeLeft')} <b id="time" ${settings.relaxed?'hidden':''}></b>${tr('tilesLeft')}<b id="count"></b></div><div class="target" id="target"></div>${level.weather?.hint?`<small class="weather-hint">${tr('rainHint')}</small>`:''}</header>${level.construction?'<div class="supply"><div class="timber-status" id="timber"></div><div id="preview"></div></div>':''}<div class="board-area"><div class="board"><canvas class="link-fx" aria-hidden="true"></canvas></div><div id="strategy-note" class="strategy-note" role="status"></div></div><footer class="strategy-footer"><div class="strategy-title">${tr('stratagems')}</div><div id="strategy-controls" class="controls"></div></footer>`,'game');syncStrategies();$('#pause').innerHTML=icon('pause');$('#pause').title=tr('campStoolPause');$('#pause').setAttribute('aria-label',tr('campStoolPause'));$('#mute').innerHTML=icon('sound');bindWeather($('#power'));const linkCanvas=$('.link-fx');if(linkCanvas.getContext)linkFx=createLinkFx(linkCanvas);$('#mute').onclick=()=>{muted=!muted;applySettings();$('#mute').setAttribute('aria-pressed',String(muted));$('#mute').title=muted?tr('soundOff'):tr('soundOn');weather({battle:true,boss:level.id===10,silent:muted||!settings.sfxEnabled,chapter,effect:level?.weather?.type,fade:level?.weather?.fade,count:level?.weather?.count,volume:settings.sfx,progress:()=>1-seconds()/level.time,emptyCells:weatherEmptyCells});};$('#pause').onclick=pause;if(!saved){updateHud();render();ensureMove();saveSession();announceStrategy();sound('start');}const tracks=musicByChapter[chapter]||musicByChapter[1];music.play(level.id===10?tracks.boss:tracks.normal);}
function dawnLimit(){const total=(level.boards[0].board.filter(Boolean).length+(level.boards[0].queues||[]).flat().length)/2;return Math.max(Math.ceil(level.time/level.supplyInterval)*2,Math.ceil(total*1.2));}
function cadence(interval){return settings.relaxed?2:interval;}
function seconds(){if(settings.relaxed)return level.time-moves;return Math.max(0,remaining-(paused?0:(battleNow()-started)/1000));}
function boardEffect(root, className, styles, duration, label=''){
 const element=document.createElement('div');
 element.className=className;
 element.style.cssText=styles;
 if(label)element.setAttribute('aria-label',label);
 else element.setAttribute('aria-hidden','true');
 root.appendChild(element);
 if(duration)setTimeout(()=>element.remove(),duration);
 return element;
}
function cavalryRows(cells, kind, {w,h,gap}){
 const root=$('.board');
 root.querySelectorAll('.squeeze-preview').forEach(e=>e.remove());
 for(const row of new Set(cells.map(i=>Math.floor(i/7)))){
  boardEffect(root,kind,`top:${row*(h+gap)}px;width:${7*w+6*gap}px;height:${h}px`,kind==='squeeze-dust'?420:0);
 }
}
function cannon(){snapshot();history.at(-1).artilleryDelay=cadence(level.artilleryInterval);const cell=level.shots[shot%level.shots.length],r=bombard({board,ids,fog,shot},level);({board,ids,fog,shot}=r);artilleryDue=seconds()-cadence(level.artilleryInterval);selected=-1;render();const root=$('.board'),{w,h,gap}=geometry();
 const x=cell%7*(w+gap)+w+gap/2,y=Math.floor(cell/7)*(h+gap)+h+gap/2;
 const position=`left:${x}px;top:${y}px`;
 boardEffect(root,'cannonball',position,620);
 boardEffect(root,'cannon-impact',position,620);
 smallTip('bombardmentABlockRotatedClockwise');ensureMove();}
function updateHud(){if(screen!=='game')return;const ticking=!paused&&demoHeldAt===null,t=Math.ceil(seconds());if(settings.relaxed&&chapter===2&&level.id===10&&moves>=dawnLimit()&&ticking){finish(false,tr('dawnBrokeBeforeTheCastleWasBuilt'));return;}if(!settings.relaxed&&!t&&ticking){finish(false,level.construction&&level.id===10?tr('dawnBrokeBeforeTheCastleWasBuilt'):tr('timeSUp'));return;}if(level.noOuter&&ticking&&!busy&&seconds()<=artilleryDue)cannon();if(level.siege&&ticking&&!busy&&seconds()<=siegeDue&&siege.layers.length<level.siegeLimit){snapshot();history.at(-1).siegeDelay=cadence(level.siegeInterval);siege=advanceSiege(board,siege,level.siegeLimit);siegeDue=seconds()-cadence(level.siegeInterval);render();const perimeter=$('.outer-fence');perimeter?.classList.add('fence-rising');setTimeout(()=>perimeter?.classList.remove('fence-rising'),300);if(chapter===3&&siegeTargetFailed(board,siege,level)){finish(false,tr('retreatFailedNagamasaGotThrough'));return;}ensureMove();if(screen!=='game')return;}if(level.construction&&ticking&&!busy&&seconds()<=supplyDue){if(supplyCount(queues)&&(level.siege?supplySiege(board,queues,level.mask,siege):supply(board,queues,level.mask)).inserted.length)snapshot();feed();supplyDue=seconds()-cadence(level.supplyInterval);if(constructionWon(board,queues)){finish(true);return;}ensureMove();if(screen!=='game')return;}if(level.construction){$('#timber').textContent=tr('timberLeftNextSupply', [supplyCount(queues), Math.max(0,Math.ceil(seconds()-supplyDue)), settings.relaxed?tr('moveUnit'):tr('secondUnit')]);$('#preview').innerHTML=queues.map(q=>q.length?`<div class="preview-tile ${level.fog?'fogged':''}">${level.fog?'':`<img src="${portrait(q[0])}" alt="${esc(short(q[0]))}">`}</div>`:'<div></div>').join('');}$('#time').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;$('#count').textContent=board.filter(Boolean).length;$('#target').textContent=level.target?tr('defeatTilesLeftMatchesToGoBy', [level.target===true?tr('yoshimoto'):short(level.target.person), level.target===true?tr('yoshimoto'):short(level.target.person), [...board,...queues.flat()].filter(v=>v===(level.target===true?9:level.target.person)).length, Math.max(0,targetSpec().beforePairs-moves), targetSpec().beforePairs]):level.construction?(level.id===10?(settings.relaxed&&chapter===2?tr('movesTillDawnClearTheBoardAnd', [Math.max(0,dawnLimit()-moves)]):tr('clearTheBoardAndTimber')):tr('buildTheCastleClearTheBoardAnd')):'';if(level.siege){$('#target').textContent=tr('barricades', [siege.layers.length, siege.layers.length>=level.siegeLimit?tr('encirclementComplete'):tr('nextBarricadeIn', [Math.max(0,Math.ceil(seconds()-siegeDue)), settings.relaxed?tr('moveUnit'):tr('secondUnit')]), chapter===3&&level.id===10?tr('nagamasaTilesLeftBeforeTheThirdBarricade', [board.filter(v=>v===10).length]):'']);badge('breakout',siege.skills);$('#breakout').disabled=!siege.skills||!siege.layers.length||busy;}if(level.fire)$('#target').textContent=tr('fire')+fire.active.map(e=>tr('movesLeft', [e.left])).join(' / ')+tr('locked')+ids.filter(id=>id&&fire.locked.includes(id)).length+tr('tiles')+(level.id===10?tr('saveNobunagaFromTheFlames'):'')+tr('message156')+$('#target').textContent;if(level.betrayal)$('#target').textContent=tr('defectionIn', [betrayalLeft, short(level.betrayTo||1)])+$('#target').textContent;if(level.left)$('#target').textContent=tr('cavalryChargeMatchedRowsShiftLeft')+(level.falling?tr('afterFalling'):'')+tr('message156')+$('#target').textContent;if(level.fog?.length)$('#target').textContent=(level.duel?tr('duelClearKenshinSFourTilesBefore'):'')+tr('foggedTiles', [fog.length])+($('#target').textContent?tr('message156')+$('#target').textContent:'');if(level.noOuter)$('.cannon-preview')?.classList.toggle('cannon-imminent',Math.ceil(seconds()-artilleryDue)<=1);if(level.noOuter)$('#target').textContent=tr('noOuterRouteBombardmentIn', [Math.max(0,Math.ceil(seconds()-artilleryDue)), settings.relaxed?tr('moveUnit'):tr('secondUnit')])+$('#target').textContent;if(chapter===1&&level.id===10&&level.target){const x=targetSpec();$('#target').classList.add('boss-target');$('#target').innerHTML=`<img src="${portrait(x.person)}" alt="${esc(short(x.person))}"><span>${esc($('#target').textContent)}</span>`;}syncStrategies();badge('undo','');$('#undo').disabled=!history.length||busy;if(!settings.relaxed&&!t&&ticking)finish(false,tr('timeSUp'));}
setInterval(updateHud,100);
function geometry(){const a=$('.board-area');const w=Math.floor(Math.min((a.clientWidth-24-18)/7,(a.clientHeight-24-21)/8));return {w,h:w,gap:3};} // 正方形牌
function render(arrivals=new Set()){if(screen!=='game')return;const root=$('.board'),{w,h,gap}=geometry();root.style.width=7*w+6*gap+'px';root.style.height=8*h+7*gap+'px';if(level.construction)$('.supply').style.width=7*w+6*gap+'px';const existing=new Map([...root.querySelectorAll('.tile')].map(e=>[+e.dataset.id,e]));const live=new Set();board.forEach((v,i)=>{if(!v)return;const id=ids[i];live.add(id);let e=existing.get(id);if(!e){e=document.createElement('button');e.className='tile';e.dataset.id=id;e.dataset.v=v;e.innerHTML=`<img src="${portrait(v)}" alt="">`;e.setAttribute('aria-label',tr('warriorTile'));root.appendChild(e);bindTile(e);}if(+e.dataset.v!==v){e.dataset.v=v;e.innerHTML=`<img src="${portrait(v)}" alt="">`;}if(chapter===2&&arrivals.has(id)){e.classList.add('arriving');e.style.setProperty('--timber-origin',-(Math.floor(i/7)*(h+gap)+h+12)+'px');}if(level.fog||level.left||level.betrayal){
 const hidden=fog.includes(i),wasHidden=e.classList.contains('fogged');
 e.innerHTML=hidden?'':`<img src="${portrait(v)}" alt="">`;
 e.classList.toggle('fogged',hidden);
 e.setAttribute('aria-label',hidden?tr('tileHiddenInFog'):tr('warriorTile'));
 if(wasHidden&&!hidden){
  e.classList.add('revealing');
  setTimeout(()=>e.classList.remove('revealing'),400);
 }
 if(level.betrayal&&!hidden){
  const previous=e.dataset.person;
  const flipped=previous&&+previous!==v;
  const to=level.betrayTo||1;
  if(flipped){
   e.classList.add('betraying');
   setTimeout(()=>e.classList.remove('betraying'),420);
  }
  if(v===(level.betrayFrom||13)||e.classList.contains('betraying')){
   const label=document.createElement('span');
   const converted=v!==(level.betrayFrom||13);
   label.className='betrayal-count '+`flag-${data.factions[to-1]}`+(converted?' flag-converted':'');
   label.textContent=converted?'0':String(betrayalLeft);
   label.title=tr('defectionIn165',[converted?0:betrayalLeft,short(to)]);
   label.setAttribute('aria-label',label.title);
   e.appendChild(label);
   if(converted)setTimeout(()=>label.remove(),420);
  }
 }
 e.dataset.person=v;
}
if(level.fire){
 e.querySelectorAll('.fire-count').forEach(n=>n.remove());
 const burning=fire.active.find(f=>f.ids.includes(id));
 const locked=fire.locked.includes(id);
 const chain=e.querySelectorAll('.chains')[0];
 e.classList.toggle('burning',!!burning);
 e.classList.toggle('chained',locked);
 if(burning){
  const label=document.createElement('span');
  label.className='fire-count';
  label.textContent=tr('tileFireCountdown',[burning.left]);
  label.title=tr('movesLeft',[burning.left]);
  e.appendChild(label);
 }
 if(locked){
  if(!chain){
   const links=document.createElement('span');
   links.className='chains';
   links.setAttribute('aria-label',tr('locked166'));
   links.innerHTML='<i></i><b></b>';
   e.appendChild(links);
  }
  chain?.classList.remove('chain-releasing');
 }else if(chain&&!chain.classList.contains('chain-releasing')){
  chain.classList.add('chain-releasing');
  setTimeout(()=>{if(chain.classList.contains('chain-releasing'))chain.remove();},300);
 }
}
e.dataset.index=i;e.classList.toggle('ima',chapter===1&&v>=9);e.classList.toggle('saito',chapter===2&&v>=10);if(chapter>=3){for(const faction of ['oda','azai','asakura','takeda','uesugi','tokugawa','akechi','hosokawa','toyotomi'])e.classList.toggle(faction,data.factions[v-1]===faction);}e.classList.toggle('selected',i===selected);e.style.width=w+'px';e.style.height=h+'px';e.style.left=(i%7)*(w+gap)+'px';e.style.top=Math.floor(i/7)*(h+gap)+'px';});existing.forEach((e,id)=>{if(!live.has(id))e.remove();});root.querySelectorAll('.cannon-preview').forEach(e=>e.remove());if(level.noOuter){const cell=level.shots[shot%level.shots.length],mark=document.createElement('div');mark.className='cannon-preview';mark.classList.toggle('cannon-imminent',Math.ceil(seconds()-artilleryDue)<=1);mark.style.cssText=`left:${cell%7*(w+gap)-2}px;top:${Math.floor(cell/7)*(h+gap)-2}px;width:${2*w+gap+4}px;height:${2*h+gap+4}px`;mark.setAttribute('aria-label',tr('nextBombardmentArea'));root.appendChild(mark);}if(level.left&&!busy)cavalryRows(selected<0?[]:[selected],'squeeze-preview',{w,h,gap});
if(level.siege){root.querySelectorAll('.fence').forEach(e=>e.remove());
 let outer=root.querySelectorAll('.outer-fence')[0];
 if(siege.layers.length&&!outer){
  outer=boardEffect(root,'outer-fence','',0);
  outer.innerHTML='<i></i><i></i><i></i><i></i>';
 }else if(!siege.layers.length)outer?.remove();
 for(const i of siege.layers.flat()){const fence=document.createElement('div');fence.className='fence';fence.style.cssText=`left:${i%7*(w+gap)}px;top:${Math.floor(i/7)*(h+gap)}px;width:${w}px;height:${h}px`;fence.setAttribute('aria-label',tr('enemyBarricade'));root.appendChild(fence);}}}
let holdTimer,held=false,pressX=0,pressY=0;
function clearHold(){clearTimeout(holdTimer);$('.name-tip')?.remove();}
function bindTile(e){e.onpointerdown=ev=>{if(busy||paused||fog.includes(+e.dataset.index))return;held=false;pressX=ev.clientX;pressY=ev.clientY;holdTimer=setTimeout(()=>{held=true;const tip=document.createElement('div');tip.className='name-tip';tip.textContent=person(board[+e.dataset.index]).name||short(board[+e.dataset.index]);const defection=e.querySelectorAll('.betrayal-count')[0];
 if(defection)tip.textContent+=' / '+defection.title;
 tip.style.left=Math.min(innerWidth-70,Math.max(70,pressX))+'px';tip.style.top=Math.max(65,pressY-15)+'px';document.body.appendChild(tip);},500);};e.onpointermove=ev=>{if(Math.hypot(ev.clientX-pressX,ev.clientY-pressY)>12){held=true;clearHold();}};e.onpointerup=clearHold;e.onclick=()=>{clearHold();if(!held)choose(+e.dataset.index);held=false;};e.onpointercancel=()=>{held=true;clearHold();};e.oncontextmenu=ev=>ev.preventDefault();}
window.addEventListener('pointerup',clearHold);window.addEventListener('resize',()=>{if(screen==='game')render();});
function snapshot(){history.push({shot,artilleryDelay:Math.max(0,seconds()-artilleryDue),betrayalLeft,fire:fire?structuredClone(fire):null,fog:fog.slice(),siege:siege?structuredClone(siege):null,siegeDelay:Math.max(0,seconds()-siegeDue),board:board.slice(),ids:ids.slice(),moves,combo,maxCombo,lastMatch,queues:queues.map(q=>q.slice()),supplyDue,supplyDelay:Math.max(0,seconds()-supplyDue)});}
async function choose(i){if(busy||paused||!board[i]||fog.includes(i))return;if(armedStrategy)return chooseStrategyTile(i);sound('select');if(selected===i){selected=-1;render();return;}if(selected<0||board[selected]!==board[i]){selected=i;render();return;}const a=selected,p=(level.fire||level.noOuter)?fireMatch(board,ids,fire,a,i,siege):path(board,a,i,false,siege);selected=-1;if(!p){sound('bad');[a,i].forEach(j=>{const e=$(`[data-index="${j}"]`);e.classList.add('shake');setTimeout(()=>e.classList.remove('shake'),350);});render();return;}
 return clearTiles([a,i],p);
}
async function clearTiles(cells,route=null){
 snapshot();busy=true;const token=run,[a,b=a]=cells,v=board[a],{w,h,gap}=geometry();
 if(level.left)cavalryRows(cells,'squeeze-preview',{w,h,gap});
 cells.forEach(i=>{
  const tile=$('[data-index="'+i+'"]');
  tile.classList.add('gone');
  if(level.fire&&fire.locked.includes(ids[i])){
   const position=`left:${i%7*(w+gap)}px;top:${Math.floor(i/7)*(h+gap)}px;width:${w}px;height:${h}px`;
   const release=boardEffect($('.board'),'chains chain-releasing',position,300);
   release.innerHTML='<i></i><b></b>';
   tile.querySelectorAll('.chains')[0]?.remove();
  }
 });
 sound('clear');
 const chained=level.fire&&fire.locked.includes(ids[a]);
 if(route?.length){
  const now=battleNow();
  combo=chained?0:now-lastMatch<=3000?combo+1:1;
  lastMatch=chained?0:now;
  maxCombo=Math.max(maxCombo,combo);
  if(combo>=2){sound(combo===2?'two':'many');const c=document.createElement('div');c.className='combo';c.textContent=tr('combo', [combo]);$('.board-area').appendChild(c);setTimeout(()=>c.remove(),1000);}
 }else{
  combo=0;lastMatch=0;
 }
 if(store.isIOS)store.haptic(combo>=2?'combo':'match',settings.vibration);
 linkFx?.play(route,cells.map(i=>[i%7,Math.floor(i/7)]),{w,h,gap},combo);
 floatName(a,b,v,w,h,gap);
 await new Promise(r=>setTimeout(r,180));if(token!==run)return;
 if(level.left){cavalryRows(cells,'squeeze-dust',{w,h,gap});smallTip('onlyThisRowShiftsLeft');gameStorage.setItem('sengoku-left-demo','1');}
 ({board,fog}=removeFogTiles(board,fog,cells,level,siege));
 for(const i of cells)ids[i]=0;
 if(level.falling)ids=siege?fallSiege(ids,level.mask,siege):fall(ids,level.mask);
 if(level.left)ids=squeezeLeft(ids,level.mask,cells.map(i=>i/7|0),siege);
 moves++;
 if(level.betrayal){const r=betray(board,betrayalLeft,level.betrayFrom,level.betrayTo);board=r.board;betrayalLeft=r.left;}if(level.fire){const r=tickFire(fire,ids,moves,level.id===10);fire=r.state;remaining=Math.max(0,seconds()-r.penalty);started=battleNow();if(r.penalty&&!settings.relaxed)toast(tr('fireLockedTheTilesSec', [r.penalty]));if(r.failed){busy=false;finish(false,tr('nobunagaCouldNotBeSaved'));return;}}render();await new Promise(r=>setTimeout(r,240));if(token!==run)return;busy=false;if(duelFailed(board,level)){finish(false,tr('duelFailedShingenFellBeforeKenshin'));return;}if(targetFailed(level.construction?[...board,...queues.flat()]:board,moves,level.target)){finish(false,chapter===1?tr('ambushFailedYoshimotoSurvived'):tr('survived', [chapter===8?tr('japanSFinestWarriorHeadquartersOutOf'):chapter===7?tr('decisiveBattleTheWesternArmyBroke'):level.left?tr('volleyFailed'):tr('castleConstructionFailed'), short(level.target.person)]));return;}if(level.construction&&!board.some(Boolean)&&supplyCount(queues)){feed();supplyDue=seconds()-cadence(level.supplyInterval);}if(!board.some(Boolean)&&(!level.construction||!supplyCount(queues))){finish(true);return;}updateHud();ensureMove();saveSession();}
function feed(){if(!supplyCount(queues))return;const r=(level.fog||level.left)?fogSupply(board,fog,queues,level,siege):level.siege?supplySiege(board,queues,level.mask,siege):supply(board,queues,level.mask);if(!r.inserted.length)return;if(level.fog||level.left)fog=r.fog;
 // Track token identities through exactly the same gravity operation.
 ids=level.siege?fallSiege(ids,level.mask,siege):fall(ids,level.mask);const arrivals=new Set();for(const i of r.inserted){ids[i]=nextTileId++;arrivals.add(ids[i]);}ids=level.siege?fallSiege(ids,level.mask,siege):fall(ids,level.mask);board=r.board;queues=r.queues;selected=-1;render(arrivals);
 if(chapter===2){const token=run,tiles=[...$('.board').querySelectorAll('.arriving')].filter(e=>arrivals.has(+e.dataset.id));
 const simple=!settings.weather||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 setTimeout(()=>{if(token===run&&screen==='game'&&!paused&&!document.hidden&&tiles.some(e=>[...$('.board').querySelectorAll('.tile')].includes(e)))sound('timber');},simple?0:300);
 setTimeout(()=>tiles.forEach(e=>e.classList.remove('arriving')),3300);
 }}
function ensureMove(){if(screen==='game'&&!paused&&!busy&&isStuck()) {stuckDialog();return;}if(screen!=='game'||paused||busy||((level.fire||level.noOuter)?firePairs(board,ids,fire,fog,siege).length:currentHint())||(!board.some(Boolean)&&(!(level.siege||level.construction)||!supplyCount(queues))))return;
 // No pair left on the board (or board cleared): bring the next timber now instead of making the player wait.
 if(level.construction&&supplyCount(queues)){const before=supplyCount(queues);feed();if(supplyCount(queues)<before){supplyDue=seconds()-cadence(level.supplyInterval);render();updateHud();ensureMove();return;}}
 if(level.fire||level.fog||level.left){reshuffle(true);return;}
 if(level.siege){reshuffle(true);return;}
 if(level.construction){const counts=new Map();board.filter(Boolean).forEach(v=>counts.set(v,(counts.get(v)||0)+1));
  // With only singletons, wait for the advertised supply tick. Reposition the
  // board to free column tops; never pull timber ahead of its fixed interval.
  if(![...counts.values()].some(n=>n>=2)){if(settings.relaxed){feed();supplyDue=seconds()-2;render();updateHud();return;}const r=shuffleConstruction(board,level.mask);if(demoMode)demoFreeShuffles++;board=r.board;ids=board.map(v=>v?nextTileId++:0);render();toast(tr('waitForTheNextTimberSupply'));return;}
 }
 reshuffle(true);
}
// These are proofs of impossibility, not a heuristic search timeout.
function fireOrFogMove(){return (level.fire||level.noOuter)?firePairs(board,ids,fire,fog,siege).length:fogPairs(board,fog,siege).length;}
function isStuck(){
 if(!board.some(Boolean))return false;
 if(fire&&!betrayalLeft){const counts=new Map();board.forEach((v,i)=>{if(v&&fire.locked.includes(ids[i]))counts.set(v,(counts.get(v)||0)+1);});if([...counts].some(([v,n])=>n%2&&![...fire.active,...fire.events.filter((e,k)=>!fire.fired.includes(k))].some(e=>e.ids.some(id=>board[ids.indexOf(id)]===v))))return true;}
 if((!queues.flat().length||!(level.siege?supplySiege(board,queues,level.mask,siege):supply(board,queues,level.mask)).inserted.length)){const counts=new Map();board.forEach((v,i)=>{if(v&&!fog.includes(i)){const key=v+':'+!!fire?.locked.includes(ids[i]);counts.set(key,(counts.get(key)||0)+1);}});if(![...counts.values()].some(n=>n>=2))return true;}
 return false;
}
function stuckDialog(){remaining=seconds();paused=true;music.pause(true);weather({paused:true});saveSession();const o=document.createElement('div');o.className='overlay';o.innerHTML='<div class="dialog"><h2>'+tr('noMovesLeft')+'</h2><div class="btn-row"><button id="stuck-undo">'+tr('retreatUndo')+'</button><button id="stuck-retry" class="primary">'+tr('restart')+'</button></div></div>';app.appendChild(o);$('#stuck-undo').disabled=!history.length;$('#stuck-undo').onclick=()=>{o.remove();paused=false;started=battleNow();music.pause(false);weather({paused:false});undo();ensureMove();};$('#stuck-retry').onclick=()=>start();}
function floatName(a,b,v,w,h,gap){const root=$('.board');const x=((a%7+b%7)/2)*(w+gap)+w/2,y=((Math.floor(a/7)+Math.floor(b/7))/2)*(h+gap)+h/2,n=document.createElement('div');n.className='float-name';n.textContent=short(v);n.style.left=x+'px';n.style.top=y+'px';root.appendChild(n);setTimeout(()=>n.remove(),1000);}
function showHint(){if(busy||paused||!heldCount('hint'))return;const p=currentHint();if(!p){if(isStuck())stuckDialog();else if(level.fire)toast(tr('tryADifferentOrderToKeepThe'));else reshuffle(true);return;}spendStrategy('hint');usedHint=true;sound('hint');p.forEach(i=>{const e=$(`[data-index="${i}"]`);e?.classList.add('hint');setTimeout(()=>e?.classList.remove('hint'),1400);});updateHud();saveSession();}
function reshuffle(free){if(busy||paused||(!free&&!heldCount('shuffle')))return;disarmStrategy();snapshot();busy=true;const r=(level.fire||level.noOuter||level.betrayal)?shuffleFire(board,ids,fire,fog,siege,Math.random,{level,queues,moves,betrayalLeft,shot}):(level.fog||level.left)?shuffleFog(board,fog,siege,Math.random,{level,queues,moves,betrayalLeft,shot}):level.siege?shuffleSiege(board,siege,Math.random,{level,queues,moves,betrayalLeft,shot}):level.construction?shuffleConstruction(board,level.mask,Math.random,{level,queues,moves,betrayalLeft,shot}):shuffle(board,level.mask,level.falling,level.target,{moves,fallbacks:level.boards});board=r.board;ids=r.ids||board.map((v,i)=>v?nextTileId++:0);selected=-1;if(!free)spendStrategy('shuffle');else if(demoMode)demoFreeShuffles++;sound('shuffle');toast(free?tr('noMovesLeftRedeploying'):tr('tilesRedeployed'));render();busy=false;if((level.fire||level.fog||level.noOuter)&&!fireOrFogMove()&&(!level.noOuter||settings.relaxed)&&!siege?.skills&&(!queues.flat().length||!(level.siege?supplySiege(board,queues,level.mask,siege):supply(board,queues,level.mask)).inserted.length)){stuckDialog();return;}if(level.fire&&!currentHint())toast(level.construction&&supplyCount(queues)?tr('waitForTheNextTimberSupply'):tr('ifLockedTilesHaveNoMatchRetreat'));if(level.fog&&!currentHint()){toast(level.construction&&supplyCount(queues)?tr('waitForTheNextFoggedTimberSupply'):tr('ifFogBlocksYourWayRetreatAnd'));}if(level.siege){const state=(level.fire||level.fog)?(currentHint()?'play':siege.skills?'skill':'lost'):siegeDeadlock(board,siege);if(state==='lost'){finish(false,tr('encircled'));return;}if(state==='skill')toast(tr('encircledUseBreakOutToRemoveA'));}updateHud();saveSession();}
function breakout(){if(busy||paused||!level.siege)return;const next=breakSiege(siege);if(!next)return;disarmStrategy();snapshot();siege=next;siegeDue=seconds()-cadence(level.siegeInterval);selected=-1;render();updateHud();ensureMove();}
function undo(){if(busy||paused||!history.length)return;disarmStrategy();const s=history.pop();board=s.board;ids=s.ids;shot=s.shot;moves=s.moves;artilleryDue=seconds()-s.artilleryDelay;betrayalLeft=s.betrayalLeft;fire=s.fire;fog=(s.fog||[]).slice();if(level.siege){siege=s.siege;siegeDue=seconds()-s.siegeDelay;}queues=s.queues.map(q=>q.slice());supplyDue=seconds()-(s.supplyDelay||cadence(level.supplyInterval));moves=s.moves;combo=0;maxCombo=s.maxCombo;lastMatch=0;selected=-1;render();updateHud();toast(tr('lastMoveUndone'));if(!level.fog&&!level.construction&&!level.siege)ensureMove();}
function pause(){if(paused||busy)return;remaining=seconds();paused=true;weather({paused:true});music.pause(true);clearHold();const o=document.createElement('div');o.className='overlay';o.innerHTML=`<div class="dialog pause-dialog"><h2>${tr('paused')}</h2><p>${tr('pausedBattleHeading', [chapterLabel(), level.id])}</p><button id="pause-settings">${tr('pauseSettingsAction', [icon('settings')])}</button><div class="btn-row"><button id="leave">${tr('selectBattle')}</button><button id="resume" class="primary">${tr('continue')}</button></div></div>`;app.appendChild(o);$('#pause-settings').onclick=()=>battleSettings();$('#resume').onclick=()=>{o.remove();paused=false;weather({paused:false});music.pause(false);started=battleNow();};$('#leave').onclick=()=>{saveSession();deploy();};}
function resultTime(elapsed){
 const seconds=Math.floor(elapsed),minutes=Math.floor(seconds/60),remainder=seconds%60;
 return minutes ? tr('resultMinutesSeconds',[minutes,remainder]) : tr('resultTime',[seconds]);
}
function finish(win,reason=''){if(screen!=='game')return;gameStorage.removeItem('sengoku-session');remaining=seconds();paused=true;const elapsed=elapsedSeconds(),spent=strategyCount(strategyRun.opening)-strategyCount(strategyRun.stock),stars=battleStars(win,remaining,level.time,settings.relaxed,spent>0);if(demoMode)demoResult={run:run+1,win,reason,elapsed,stars};const id=level.id,wasCleared=!!progress.stars[id-1],wasChapterCleared=progress.stars.every(Boolean);const wasMaster=progress.stars.every(v=>v===3);const province=mapEntry()?.province,newProvince=win&&province&&!conquered().has(province);if(newProvince)recentOccupation={province,chapter};const replay=strategyRun.replay||wasCleared;let reward={rows:[],total:0,state:readMerit(gameStorage)};
 if(win){
  if(store.isIOS)store.haptic('win',settings.vibration);
  if(!replay){
   const leftovers=id===10?strategyCount(strategyRun.stock):null;
   progress.strategy={...chapterStrategies(),stock:id===10?{}:{...strategyRun.stock}};
   const stats={win,remaining,time:level.time,maxCombo,usedHint,relaxed:settings.relaxed,leftovers};
   (progress.pendingMerit??=[]).push({id,stats});
  }
  progress.stars[id-1]=Math.max(progress.stars[id-1],stars);
  if(save()&&!replay){
   try{reward=settleBattleMerit(chapter,progress)??reward;save();}
   catch{reward.state=readMerit(gameStorage);toast(tr('couldNotSaveMerit'));}
  }
  if(!wasChapterCleared&&progress.stars.every(Boolean))gameStorage.setItem('sengoku-unread','1');
 }
 if(!win)sound('lose');view(`${meritCounter(reward.state.balance-reward.total)}<div class="eyebrow">${tr('resultBattleHeading', [chapterLabel(), id])}</div><div class="result-map"><div class="result-geography"><div class="result-map-art">${mapSVG(win?(province||''):'',newProvince?'province-flash':'province-glint')}<span aria-label="${win?tr('victory'):tr('defeat')}" class="sea-stamp ${win?'':'defeat'}">${win?tr('win'):tr('loss')}</span></div></div><div class="map-caption">${win?(newProvince?tr('resultConquest',[esc(provinceName(province))]):tr('territorySecured')):esc(reason)} ${conquered().size}/66</div></div>${win?settlementHTML(reward):'<p>'+tr('giveItAnotherTry')+'</p>'}<div class="reward-summary"><strong id="merit-total">${tr('initialMeritAward')}</strong><span class="resultStars merit-stars" style="--stars-delay:0s">${win?'★'.repeat(stars)+'☆'.repeat((settings.relaxed?2:3)-stars):'☆☆☆'}</span></div><p class="result-stats">${tr('bestCombo', [settings.relaxed?tr('resultMatches',[moves]):tr('resultTime',[Math.floor(elapsed)]), maxCombo, win&&!wasMaster&&progress.stars.every(v=>v===3)?tr('chapterMastered'):''])}</p><p class="strategy-result">${tr('stratagemsUsedLeft', [spent, strategyCount(strategyRun.stock)])}</p><p class="star-conditions">${settings.relaxed?tr('relaxedModeAwardsUpToTwoStars'):tr('twoStarsWithTimeLeftThreeStars')}</p><div class="result-actions btn-row"><button id="retry">${tr('tryAgain')}</button>${win&&id<10?'<button class="primary" id="next">'+tr('nextBattleAction')+'</button>':win&&chapter<8?'<button id="next-chapter" class="primary">'+tr('nextChapter')+'</button>':'<button id="levels" class="primary">'+(win?tr('unification'):tr('viewMap'))+'</button>'}</div>${win&&!(id===10&&chapter===8)?'<button id="levels" class="result-levels">'+tr('selectBattle')+'</button>':''}`,'center result');if(win){if(reward.total)animateMerit(reward);effectMusic.play('jingle_clear');const token=run;if(newProvince)occupationSound();}$('#retry').onclick=deploy;$('#levels').onclick=win&&(unified()||(chapter===8&&id===10))?ending:win?selectLevel:selectChapter;if(win&&(unified()||(chapter===8&&id===10)))$('#levels').textContent=unified()?tr('unification'):tr('epilogueAction');if($('#next'))$('#next').onclick=()=>enter(id);if($('#next-chapter'))$('#next-chapter').onclick=()=>{const n=chapter+1;if(!previewAll&&!store.isUnlocked()){if(chapter===1)futureBattles();else unlockPage(()=>{switchChapter(n);enter(0);});return;}switchChapter(n);enter(0);};if(win&&chapter===1&&id===10&&!wasCleared&&!previewAll&&!store.isUnlocked()){const token=run;setTimeout(()=>{if(run===token)futureBattles();},4200);}}
function ending(){const complete=unified();view(`<div class="eyebrow">${complete?tr('battlesComplete'):tr('roadToUnification')}</div><h2>${complete?tr('unification220'):tr('epilogueTitle')}</h2>${mapSVG(recentOccupation?.province||'')}<p>${complete?tr('peaceHasDawnedAcrossTheSixtySix'):tr('moreBattlesAwaitBrCompleteAllEighty')}</p><button id="chapters" class="primary">${tr('chapters')}</button>`,'center unification');$('#chapters').onclick=selectChapter;if(recentOccupation)occupationSound();}
document.addEventListener('visibilitychange',()=>{if(!demoMode&&document.hidden&&screen==='game'&&!paused&&!busy)pause();});

const SETTINGS_KEY='sengoku-settings';
function readJSON(key,fallback){try{return JSON.parse(gameStorage.getItem(key))??fallback;}catch{return fallback;}}
const settings={music:1,sfx:1,musicEnabled:true,sfxEnabled:true,vibration:true,weather:true,relaxed:false,largeText:false,...readJSON(SETTINGS_KEY,{})};
function applySettings(){document.body.classList.toggle('large-text',settings.largeText);effectMusic.volume(settings.sfx);effectMusic.mute(muted||!settings.sfxEnabled||settings.sfx<=0);music.volume(settings.music);music.mute(muted||!settings.musicEnabled||settings.music<=0);weather({volume:settings.sfx,silent:muted||!settings.sfxEnabled});setWeather(settings.weather);for(const [k,a] of Object.entries(audio)){a.volume=settings.sfx*(k==='timber'?.14:k==='coin'?.18:1);a.muted=muted||!settings.sfxEnabled;if(a.muted||settings.sfx<=0){a.pause?.();a.removeAttribute?.('src');a.load?.();}}}
function bindWeather(b){b.innerHTML=icon('weather');b.title=settings.weather?tr('weatherEffectsOn'):tr('weatherEffectsOff');b.setAttribute('aria-pressed',String(!settings.weather));b.onclick=()=>{settings.weather=!settings.weather;gameStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));applySettings();bindWeather(b);};}
function unread(){return gameStorage.getItem('sengoku-unread')==='1';}
function switchChapter(n){chapters.get(chapter).progress=progress;chapter=n;({data,text,progress}=chapters.get(n));}
function currentCard(){let target;for(const [n,c]of chapters){const i=c.progress.stars.findIndex(v=>!v);if(i>=0){target={chapter:n,id:i+1};break;}}target??={chapter:8,id:10};switchChapter(target.chapter);level=data.levels[target.id-1];if(chapter>1&&!previewAll&&!store.isUnlocked())unlockPage(deploy);else deploy();}
function validSession(s){
 try{
 if(!s||!(s.version===undefined||s.version===1||s.version===2)||!chapters.has(s.chapter)||!Number.isInteger(s.id)||s.id<1||s.id>10||typeof s.relaxed!=='boolean')return false;
 const l=chapters.get(s.chapter).data.levels[s.id-1],max=chapters.get(s.chapter).data.names.length;
 const num=(v,min=0)=>Number.isFinite(v)&&v>=min,integer=(v,min=0)=>Number.isInteger(v)&&v>=min;
 const cells=v=>Array.isArray(v)&&v.every(i=>integer(i)&&i<56)&&new Set(v).size===v.length;
 const values=v=>Array.isArray(v)&&v.length<=224&&v.every(x=>integer(x)&&x<=max);
 function state(t){
 if(!t||!Array.isArray(t.board)||!values(t.board.map(v=>v===null?0:v))||t.board.length!==56||!Array.isArray(t.ids)||t.ids.length!==56||!t.ids.every((id,i)=>integer(id)&&!!id===!!t.board[i])||new Set(t.ids.filter(Boolean)).size!==t.ids.filter(Boolean).length)return false;
 if(!Array.isArray(t.queues)||t.queues.length!==7||!t.queues.every(values)||(!l.construction&&t.queues.flat().length)||!cells(t.fog)||t.fog.some(i=>!t.board[i])||(!l.fog&&t.fog.length)||t.board.some((v,i)=>v&&!l.mask.includes(i))||!integer(t.moves)||!integer(t.combo)||!integer(t.maxCombo)||!integer(t.shot)||!integer(t.betrayalLeft)||t.betrayalLeft>(l.betrayal||0))return false;
 if(l.siege){const z=t.siege;if(!z||!Array.isArray(z.layers)||z.layers.length>l.siegeLimit||!z.layers.every(cells)||!integer(z.advances)||!integer(z.skills)||z.skills>(l.id===10?2:1)||!num(t.siegeDelay))return false;}else if(l.noOuter){if(!t.siege?.noOuter||!Array.isArray(t.siege.layers)||t.siege.layers.length)return false;}else if(t.siege!==null)return false;
 if(l.fire||l.noOuter){const f=t.fire;if(!f||!Array.isArray(f.events)||!Array.isArray(f.active)||!Array.isArray(f.locked)||!Array.isArray(f.fired))return false;const event=e=>e&&Array.isArray(e.ids)&&e.ids.length===2&&e.ids.every(x=>integer(x,1)&&x<=56)&&new Set(e.ids).size===2&&integer(e.after)&&integer(e.turns,1);if(!f.events.every(event)||!l.boards.some(o=>JSON.stringify(o.events||[])===JSON.stringify(f.events))||new Set(f.fired).size!==f.fired.length||new Set(f.locked).size!==f.locked.length||!f.active.every(e=>event(e)&&integer(e.left,1)&&e.left<=e.turns&&f.events.some((original,k)=>f.fired.includes(k)&&original.after===e.after&&original.turns===e.turns&&original.ids.join()===e.ids.join()))||!f.locked.every(x=>integer(x,1)&&x<=56)||!f.fired.every(k=>integer(k)&&k<f.events.length))return false;}else if(t.fire!==null)return false;
 if(targetFailed([...t.board,...t.queues.flat()],t.moves,l.target)||duelFailed(t.board,l)||(s.chapter===3&&l.siege&&siegeTargetFailed(t.board,t.siege,l)))return false;
 return (!l.construction||num(t.supplyDelay))&&(!l.noOuter||num(t.artilleryDelay));
 }
 return num(s.remaining,.000001)&&s.remaining<=l.time+(s.version===2?15*((s.strategyRun?.opening.toki||0)-(s.strategyRun?.stock.toki||0)):0)&&
 (s.version!==2?integer(s.hints)&&s.hints<=3&&integer(s.shuffles)&&s.shuffles<=2:validStrategyRun(s.strategyRun)&&
  (s.armedStrategy===null&&s.strategyFirstId===0||
   ['monomi','shinobi','sougakari'].includes(s.armedStrategy)&&s.strategyRun.stock[s.armedStrategy]>0&&
   integer(s.strategyFirstId)&&(!s.strategyFirstId||s.armedStrategy==='shinobi')))&&integer(s.nextTileId,10000)&&typeof s.usedHint==='boolean'&&integer(s.selected,-1)&&s.selected<56&&(s.selected===-1||(s.board[s.selected]&&!s.fog.includes(s.selected)))&&(s.lastMatchAge===null||num(s.lastMatchAge))&&state(s)&&Array.isArray(s.history)&&s.history.every(state);
 }catch{return false;}
}
let splashShown=false;
function title(next=home){if(splashShown&&!demoMode){home();return;}splashShown=true;view(`<button id="begin" class="splash-hit"><span class="splash-title">${tr('gameTitle')}</span><small>${tr('tapToStart')}</small><em class="splash-progress">${tr('unification228', [conquered().size])}</em></button>`,'splash');const splashToken=run;if(!demoMode)setTimeout(()=>{if(run===splashToken&&screen==='splash')$('#begin').onclick();},2000);$('#begin').onclick=next;}
function home(){const saved=readJSON('sengoku-session',null);if(validSession(saved)){view(`<h2>${tr('resumeYourLastBattle')}</h2><p>${tr('chapterBattle', [saved.chapter, saved.id])}</p><div class="btn-row"><button id="fresh">${tr('startOver')}</button><button id="continue" class="primary">${tr('resume')}</button></div>`,'center');$('#continue').onclick=()=>{if(saved.chapter>1&&!previewAll&&!store.isUnlocked()){unlockPage(()=>resumeSession(saved));return;}resumeSession(saved);};$('#fresh').onclick=()=>{gameStorage.removeItem('sengoku-session');switchChapter(saved.chapter);enter(saved.id-1);};}else {if(gameStorage.getItem('sengoku-session')){gameStorage.removeItem('sengoku-session');toast(tr('couldNotResumeTheBattleProgressAnd'));}currentCard();}}
function pageTab(key,choices,selected){return `<nav class="catalog-tabs page-tabs" aria-label="${tr('pages')}">${choices.map(([id,label])=>`<button data-page-tab="${id}" aria-current="${id===selected?'page':'false'}">${label}</button>`).join('')}</nav>`;}
function savedTab(key,choices,value){const selected=(typeof value==='string'?value:null)??readJSON('sengoku-tabs',{})[key]??choices[0][0];return choices.some(c=>c[0]===selected)?selected:choices[0][0];}
function bindPageTabs(key,render){document.querySelectorAll('[data-page-tab]').forEach(b=>b.onclick=()=>{const tabs=readJSON('sengoku-tabs',{});tabs[key]=b.dataset.pageTab;gameStorage.setItem('sengoku-tabs',JSON.stringify(tabs));render(b.dataset.pageTab);});}
let settingsReturn=null;
function settingsPage(tab){const choices=[['sound',tr('soundDisplay')],['data',tr('data')]];tab=savedTab('settings',choices,tab);view(`${meritCounter()}<header class="toolbar"><h2>${tr('settings')}</h2><button id="close-settings">${tr('back')}</button></header>${pageTab('settings',choices,tab)}${tab==='sound'?`<label class="setting-row">${tr('language')} <button id="language-setting" lang="${activeLanguage}">${languages[activeLanguage]} ▾</button></label>${[['music',tr('backgroundMusic')],['sfx',tr('soundEffects')]].map(([key,label])=>`<div class="setting-row sound-row"><label for="${key}-volume">${label} <output id="${key}-value">${Math.round(settings[key]*100)}</output></label><input id="${key}-volume" aria-label="${tr('volume', [label])}" type="range" min="0" max="100" step="1" value="${Math.round(settings[key]*100)}"><input id="${key}-enabled" aria-label="${tr('toggle', [label])}" type="checkbox" role="switch" ${settings[key+'Enabled']?'checked':''}></div>`).join('')}<label class="setting-row">${tr('vibration')}<input id="vibration-setting" type="checkbox" role="switch" ${settings.vibration?'checked':''}></label><label class="setting-row">${tr('weatherEffects')}<input id="weather-setting" type="checkbox" role="switch" ${settings.weather?'checked':''}></label><label class="setting-row">${tr('textSize')}<button id="text-size">${settings.largeText?tr('large'):tr('standard')} ▾</button></label><label class="setting-row">${tr('relaxedModeLabel')}<input id="relaxed-setting" type="checkbox" role="switch" ${settings.relaxed?'checked':''}></label><p class="mode-explanation">${tr('noTimerSiegeRescueAndMoveTargets')}<br>${tr('twoStarsAtMostWinWithoutStratagems')}<br>${tr('clearWithAtLeastTimeLeftIn')}</p>`:`<div class="settings-buttons"><button id="help">${tr('howToPlay')}</button><button id="treasury">${tr('collectionAction', [unread()?'<i class="red-dot"></i>':''])}</button><button id="tutorial-again">${tr('tutorial')}</button><button id="about">${tr('about')}</button><button id="settings-restore">${tr('restorePurchases')}</button><button id="erase">${tr('eraseData')}</button></div>`}`,'settings paged');$('#close-settings').onclick=()=>{const back=settingsReturn;settingsReturn=null;if(back)back();else deploy();};bindPageTabs('settings',settingsPage);if(tab==='sound'){$('#language-setting').onclick=()=>choiceDialog(tr('language'),Object.entries(languages),changeLanguage,true);const persist=()=>{gameStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));applySettings();};for(const key of ['music','sfx']){ $('#'+key+'-volume').oninput=e=>{settings[key]=Number(e.target.value)/100;$('#'+key+'-value').textContent=e.target.value;persist();};$('#'+key+'-enabled').oninput=e=>{settings[key+'Enabled']=e.target.checked;persist();};}for(const key of ['weather','vibration','relaxed'])$('#'+key+'-setting').oninput=e=>{settings[key]=e.target.checked;if(key==='relaxed')gameStorage.removeItem('sengoku-session');persist();};$('#text-size').onclick=()=>choiceDialog(tr('textSizeTitle'),[['standard',tr('standard')],['large',tr('large')]],v=>{settings.largeText=v==='large';persist();settingsPage('sound');});return;}$('#settings-restore').onclick=()=>runStoreAction('restore',[$('#settings-restore')],toast);$('#treasury').onclick=openCollection;$('#help').onclick=()=>helpPage();$('#tutorial-again').onclick=()=>tutorialPage(settingsPage);
$('#about').onclick=()=>{view('<h2>'+tr('about')+'</h2><p>'+tr('gameTitle')+'</p><p>'+tr('soundEffects256')+'<a href="https://soundeffect-lab.info/" target="_blank" rel="noopener">'+tr('soundEffectLab')+'</a><br>'+tr('particles')+'<a href="https://kenney.nl/assets/particle-pack" target="_blank" rel="noopener">Kenney Particle Pack（CC0）</a><br>'+tr('warriorAndBackgroundArtGeneratedWithAi')+'<br>'+tr('mapAdaptedFromAshCrowHyakurakutoCc')+'</p><button id="return">'+tr('back')+'</button>','settings');$('#return').onclick=settingsPage;};$('#erase').onclick=()=>{view('<h2>'+tr('eraseYourData')+'</h2><p>'+tr('thisErasesProgressTheRosterTheCurrent')+'</p><div class="btn-row"><button id="cancel">'+tr('cancel')+'</button><button id="confirm-erase" class="danger">'+tr('erase')+'</button></div>','settings');$('#cancel').onclick=settingsPage;$('#confirm-erase').onclick=async()=>{for(const key of storageKeys())if(key.startsWith('sengoku-')&&!['sengoku-store-v1','sengoku-mock-receipt'].includes(key))gameStorage.removeItem(key);if(store.isIOS)await gameStorage.flush();location.reload();};};}
function tutorialDiagram(n){const rows=[[tr('connectMatchingWarriorsWithUpToTwo'),'▣ ━ ┓<br>　　 ┃<br>▣ ━ ┛'],[tr('timberArrivesFromAbove'),'▣ ▣ ▣<br>↓ ↓ ↓<br>□ □ □'],[tr('useBreakOutToClearEnemyBarricades'),tr('brBreakOutBr')],[tr('matchAdjacentTilesToClearFog'),tr('brMatchFogClears')],[tr('matchedRowsShiftLeft'),'▣ □ ▣<br>← ←<br>▣ ▣ □'],[tr('fireSpreadsWithEachMove'),tr('movesLeftBrMatchBeforeTheyBurn')],[tr('prepareForKobayakawaSDefection'),tr('defectionInIeyasuBrAtZeroRemaining')],[tr('noOuterRouteBombardmentRotatesTiles'),'▣ ▣<br>↻ 2×2<br>▣ ▣']];const r=rows[n-1];return `<div class="tutorial-diagram"><b>${r[0]}</b><div>${r[1]}</div><small>${tr('upToTwoTurnsCrossingTiles')}</small></div>`;}
function tutorialPage(next,n=chapter){const c=chapters.get(n);view(`<h2>${n===1?tr('basicTutorialTitle'):tr('newRulesForChapter', [n])}</h2>${tutorialDiagram(n)}<p>${tr('connectTwoTilesOfTheSameWarrior')}</p>${n>1?`<p>${Object.entries(c.text.rules||{}).filter(([k])=>!k.startsWith('target')&&k!=='boss').map(([,v])=>esc(v)).join('<br>')}</p>`:''}<button id="tutorial-done" class="primary">${tr('gotIt')}</button>`,'settings');$('#tutorial-done').onclick=next;}
function tutorialIfNeeded(next){next();const key=`sengoku-tutorial-${chapter}`;if(level.id===1&&!gameStorage.getItem(key)){spotlightTutorial(()=>gameStorage.setItem(key,'1'));}else if(level.falling)smallTip('afterAMatchTilesAboveItDrop');}
function helpPage(tab){const choices=[['basic',tr('basics')],['strategy',tr('stratagems')],['chapters',tr('chapterRules')],['merit',tr('meritCamp')]];tab=savedTab('help',choices,tab);const n=Number(readJSON('sengoku-help-chapter',1)),c=chapters.get(n)||chapters.get(1);const relaxed=tr('relaxedRules').split('\n')[n]||tr('noTimerTimeStarOrRemainingTime');const rules=[...(n===1?[tr('chapterOneBasicRule')]:Object.values(c.text.rules||{})), tr('relaxedModePrefix')+relaxed];const rp=pager('help-rules-'+n,rules.length);view(`<header class="toolbar"><h2>${tr('howToPlay')}</h2><button id="help-back">${tr('back')}</button></header>${pageTab('help',choices,tab)}<div class="help-content">${tab==='basic'?`${tutorialDiagram(1)}<p>${tr('basicMatchingHelp')}</p><p>${tr('twoStarsWithTimeLeftThreeWith')}</p>`:tab==='strategy'?strategyHelp().split('<h3>'+tr('relaxedMode')+'</h3>')[0]:tab==='merit'?'<p>'+tr('earnMeritForVictoryTimeLeftCombos')+'</p><p>'+tr('tradeMeritInCampForTileSkins')+'</p>':`<nav class="chapter-pages">${[...chapters].map(([i])=>`<button data-help-chapter="${i}" aria-current="${i===n?'page':'false'}">${i}</button>`).join('')}</nav><h3>${tr('helpChapterHeading', [n, esc(c.text.chapter?.title)])}</h3>${tutorialDiagram(n)}<p>${esc(rules[rp.index])}</p>${rp.html}<p class="muted">${tr('browseTheRulesOneAtATime')}</p>`}</div>`,'settings paged help');$('#help-back').onclick=()=>settingsPage('data');bindPageTabs('help',helpPage);if(tab==='chapters')rp.bind(()=>helpPage('chapters'));document.querySelectorAll('[data-help-chapter]').forEach(b=>b.onclick=()=>{gameStorage.setItem('sengoku-help-chapter',b.dataset.helpChapter);helpPage('chapters');});}
function extraCollection(tab){gameStorage.setItem('sengoku-collection-tab',tab);gameStorage.removeItem('sengoku-unread');const page=pager('art',chapters.size);view(`<header class="toolbar"><h2>${tr('collection')}</h2><button id="extra-close">${tr('back')}</button></header><nav class="catalog-tabs"><button id="extra-people">${tr('warriors')}</button><button id="extra-art">${tr('art')}</button><button id="extra-form">${tr('formation')}</button><button id="extra-music">${tr('music')}</button></nav>${tab==='music'?'<p>'+tr('theMusicCollectionWillOpenInA')+'</p>':page.html+[...chapters].slice(page.index,page.index+1).map(([n,c])=>`<section><h3>${tr('galleryChapterHeading', [n, esc(c.text.chapter?.title)])}</h3>${c.progress.stars.every(Boolean)?`<a href="img/ch${n}_intro.jpg" target="_blank"><img class="gallery-art" src="img/ch${n}_intro.jpg" alt="${tr('chapterIllustration', [n])}"></a>`:'<div class="locked-art"><img src="img/fx/scroll.png" alt=""> '+tr('clearAllTenBattlesInThisChapter')+'</div>'}</section>`).join('')}`,'collection paged');if(tab!=='music')page.bind(()=>extraCollection(tab));$('#extra-close').onclick=()=>settingsPage('data');$('#extra-people').onclick=collection;$('#extra-art').onclick=()=>extraCollection('art');$('#extra-form').onclick=formationCollection;$('#extra-music').onclick=()=>extraCollection('music');}
// Shown after the free chapter celebration; dismissing never opens a transaction.
function futureBattles(){
 const rules=['timberSupply','encirclement','fog','futureCavalry','futureFire','futureDefection','futureBombardment'];
 view(`<div class="eyebrow">${tr('chapterComplete')}</div><h2>${tr('theBattlesAhead')}</h2><div class="future-sketches">${rules.map((rule,i)=>{
 const n=i+2;
 const title=chapters.get(n)?.text.chapter?.title||tr('chapterLabel.'+n);
 return `<figure><img src="img/ch${n}_intro.jpg" alt=""><figcaption><strong>${esc(title)}</strong><span>${tr(rule)}</span></figcaption></figure>`;
 }).join('')}</div><p>${tr('chaptersBattlesWarriorRosterUnification')}</p><p>${tr('newBattlesAwaitInChapters')}<br>${tr('unlockAllEightChaptersPermanentlyWithOne')}</p><small>${tr('theRosterAndMapAreAvailableFrom')}<br>${tr('battlesStillProgressInOrderAfterPurchase')}</small><div class="btn-row"><button id="future-later">${tr('later')}</button><button id="future-unlock" class="primary">${tr('unlockFullGame')}</button></div>`,'center future-battles');
 $('#future-later').onclick=()=>{switchChapter(1);selectLevel();};
 $('#future-unlock').onclick=()=>unlockPage(()=>{switchChapter(2);enter(0);});
}
const storeMessages={
 none:'noPurchasesToRestore',cancel:'purchaseCanceled',pending:'store.pending',
 network:'store.network',fail:'couldNotCompleteTheRequestTryAgain'
};
async function runStoreAction(action,buttons,showStatus,onSuccess){
 const currentView=run;
 buttons.forEach(button=>button.disabled=true);
 try{
  const response=await store[action]();
  if(run!==currentView)return;
  const result=response===true?'ok':response===false?(action==='restore'?'none':'cancel'):response;
  if(result==='ok'&&store.isUnlocked()){
   if(onSuccess)onSuccess();
   else showStatus(tr('store.restored'));
  }else showStatus(tr(action==='restore'&&result==='cancel'?'store.restoreCanceled':storeMessages[result]||storeMessages.fail));
 }catch{
  if(run===currentView)showStatus(tr(storeMessages.fail));
 }finally{
  buttons.forEach(button=>button.disabled=false);
 }
}
async function unlockPage(next){view('<h2>'+tr('unlockTitle')+'</h2><p>'+tr('theFirstTenBattlesInChapterAre')+'</p><p>'+tr('chaptersBattlesWarriorRosterUnification')+'<br>'+tr('unlockAllEightChaptersPermanentlyWithOne')+'</p><p id="price">'+tr('checkingPrice')+'</p><button id="purchase" class="primary">'+tr('buy')+'</button><div class="btn-row"><button id="store-back">'+tr('back')+'</button><button id="restore">'+tr('restorePurchases')+'</button></div><p id="store-status" role="status"></p>','settings');$('#store-back').onclick=()=>{switchChapter(1);level=data.levels[9];deploy();};const priceEl=$('#price'),purchaseButton=$('#purchase');
 store.getPrice(tr).then(price=>{
  if(store.isIOS&&price!==tr('store.appStorePrice')){
   purchaseButton.textContent=tr('store.buyWithPrice',[price]);
   priceEl.hidden=true;
  }else priceEl.textContent=price;
 }).catch(()=>{priceEl.textContent=tr('priceUnavailable');});
 const buttons=[purchaseButton,$('#restore')],status=$('#store-status');
 for(const action of ['purchase','restore'])$('#'+action).onclick=()=>runStoreAction(action,buttons,message=>{status.textContent=message;},next);
}

function saveSession(){if(screen!=='game'||busy||!board)return;try{gameStorage.setItem('sengoku-session',JSON.stringify({version:2,strategyRun,armedStrategy,strategyFirstId,tips:[...tipKeys],relaxed:settings.relaxed,chapter,id:level.id,board,ids,history,moves,combo,selected,lastMatchAge:lastMatch?battleNow()-lastMatch:null,maxCombo,usedHint,remaining:seconds(),queues,nextTileId,fire,fog,siege,shot,betrayalLeft,artilleryDelay:level.noOuter?Math.max(0,seconds()-artilleryDue):null,siegeDelay:level.siege?Math.max(0,seconds()-siegeDue):null,supplyDelay:level.construction?Math.max(0,seconds()-supplyDue):null}));}catch{}}
function resumeSession(s){if(!validSession(s)){gameStorage.removeItem('sengoku-session');currentCard();toast(tr('couldNotResumeTheBattleProgressAnd'));return false;}s=structuredClone(s);s.board=s.board.map(v=>v||0);s.history.forEach(t=>t.board=t.board.map(v=>v||0));s.nextTileId=Math.max(s.nextTileId,...s.ids.map(id=>id+1),...s.history.map(t=>Math.max(...t.ids)+1));settings.relaxed=!!s.relaxed;gameStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));switchChapter(s.chapter);level=data.levels[s.id-1];start(s);tipKeys=new Set(Array.isArray(s.tips)?s.tips.filter(v=>typeof v==='string'):[]);({board,ids,history,moves,maxCombo,usedHint,remaining,queues,nextTileId,fire,fog,siege,shot,betrayalLeft}=s);paused=false;started=battleNow();artilleryDue=remaining-s.artilleryDelay;siegeDue=remaining-s.siegeDelay;supplyDue=remaining-s.supplyDelay;combo=s.combo||0;selected=Number.isInteger(s.selected)?s.selected:-1;lastMatch=s.lastMatchAge===null?0:battleNow()-(s.lastMatchAge||0);render();updateHud();showStrategyPrompt();ensureMove();saveSession();}
setInterval(saveSession,250);window.addEventListener('pagehide',saveSession);

const originalTextPaths=[
 'text/ch1.json','text/ch2.json','text/ch3.json','text/ch4.json',
 'text/ch5.json','text/ch6.json','text/ch7.json','text/ch8.json'
];
const originalCatalogPath='text/catalog.json';
let activeLanguage;
let languageLoading=false;
const chapterName=n=>tr('place.chapter'+n);
const provinceName=id=>tr('province.'+id);

async function fetchJSON(path){
 const response=await fetch(path);
 if(!response.ok)throw new Error('Could not load '+path);
 return response.json();
}

async function loadLanguageText(locale){
 const chapterPaths=locale==='ja'?originalTextPaths:originalTextPaths.map((_,i)=>`text/${locale}/ch${i+1}.json`);
 const catalogPath=locale==='ja'?originalCatalogPath:`text/${locale}/catalog.json`;
 const [nextCatalog,...stories]=await Promise.all([catalogPath,...chapterPaths].map(fetchJSON));
 return {nextCatalog,stories};
}

function useLanguage(locale,messages){
 activeLanguage=locale;
 i18n.use(messages);
 if(document.documentElement)document.documentElement.lang=locale;
 document.title=tr('gameTitle');
}

async function changeLanguage(locale){
 if(languageLoading||!Object.hasOwn(languages,locale))return;
 const currentView=run;
 languageLoading=true;
 try{
  const translation=locale===activeLanguage ? null : await Promise.all([
   loadMessages(locale,fetch),loadLanguageText(locale)
  ]);
  if(run!==currentView)return;
  gameStorage.setItem(SETTINGS_KEY,JSON.stringify({...settings,language:locale}));
  settings.language=locale;
  if(translation){
   const [messages,{nextCatalog,stories}]=translation;
   catalog=nextCatalog;
   for(const [id,entry] of chapters)entry.text=stories[id-1];
   text=chapters.get(chapter).text;
   useLanguage(locale,messages);
  }
  settingsPage('sound');
 }catch(error){
  console.error(error);
  if(run===currentView)toast(tr('languageChangeFailed'));
 }finally{
  languageLoading=false;
 }
}

applySettings();
try{
 const preferences=typeof navigator==='undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
 const locale=initialLanguage(settings.language,store.isIOS||typeof location==='undefined'?'':location.search,preferences);
 useLanguage(locale,await loadMessages(locale,fetch));
 const {nextCatalog,stories}=await loadLanguageText(locale);
 catalog=nextCatalog;loadCollection();
 for(const n of [1,2,3,4,5,6,7,8]){
 const d=await fetchJSON(n===1?'data/levels.json':`data/levels_ch${n}.json`);
 const t=stories[n-1];
 let p={stars:Array(10).fill(0),intro:false};try{const saved=JSON.parse(gameStorage.getItem(`sengoku-ch${n}-v1`));if(Array.isArray(saved?.stars))p={stars:Array.from({length:10},(_,i)=>Math.min(3,Math.max(0,Number(saved.stars[i])||0))),intro:!!saved.intro,strategy:saved.strategy,pendingMerit:Array.isArray(saved.pendingMerit)?saved.pendingMerit:[]};}catch{}
 if(p.pendingMerit?.length){
  try{settleBattleMerit(n,p);gameStorage.setItem(`sengoku-ch${n}-v1`,JSON.stringify(p));}catch{}
 }
 chapters.set(n,{data:d,text:t,progress:p});}
 for(const c of chapters.values())for(const l of c.data.levels)if(c.progress.stars[l.id-1])collectDebut(c.data,l);
 worldMap=await fetch('data/map.json').then(r=>{if(!r.ok)throw new Error(tr('couldNotLoadMap'));return r.json();});
 for(const v of worldMap.levels)chapters.get(v.chapter).data.levels[v.level-1].province=v.province;
 ({data,text,progress}=chapters.get(1));title();
 if(demoMode)window.sengokuDemo={
  startAt(ch,stage){
   if(!previewAll||!chapters.get(ch)?.data.levels[stage-1])throw new Error('无法进入所选关卡，请用 ?all&demo 打开游戏。');
   const enterStage=()=>{switchChapter(ch);enter(stage-1);};
   if(screen==='splash')$('#begin').onclick=enterStage;
   else title(enterStage);
  },
  state(){
   const result=demoResult?.run===run?demoResult:null;
   const game=screen==='game',tutorial=game&&$('#spotlight-next');
   const stuck=game&&$('#stuck-retry');
   const viewName=result?'result':tutorial?'tutorial':stuck?'stuck':$('#go')?'deploy':screen;
   return {
    screen:viewName,run,chapter,stage:level?.id,busy,selected,
    remaining:game||result?seconds():null,elapsed:game||result?elapsedSeconds():null,
    tiles:game||result?board.filter(Boolean).length:null,
    pairs:game||result?moves:0,hintsUsed:game||result?spentCount('hint'):0,
    shufflesUsed:game||result?spentCount('shuffle'):0,strategiesUsed:game||result?strategyCount(strategyRun.opening)-strategyCount(strategyRun.stock):0,freeShuffles:game||result?demoFreeShuffles:0,
    canBreakout:game&&!paused&&!busy&&!!siege?.skills&&!!siege.layers.length,
    canUndoStuck:!!stuck&&!$('#stuck-undo').disabled,
    stuckReason:stuck?$('.dialog h2')?.textContent ?? tr('noMovesLeft'):null,
    result:result&&{win:result.win,reason:result.reason,elapsed:result.elapsed,stars:result.stars}
   };
  },
  position(){
   if(screen!=='game'||paused||busy)return null;
   const time=seconds();
   return {
    level,chapter,board,ids,fog,queues,fire,siege,shot,moves,selected,strategies:{...strategyRun.stock},
    left:betrayalLeft,nextId:nextTileId,canUndo:history.length>0,
    expires:settings.relaxed?Infinity:time,
    artilleryAt:level.noOuter?time-artilleryDue:Infinity,
    siegeAt:level.siege?time-siegeDue:Infinity,
    supplyAt:level.construction&&supplyCount(queues)?time-supplyDue:Infinity
   };
  },
  nextPair(){return screen==='game'&&!paused&&!busy?currentHint()??null:null;},
  pauseTimer(hold){
   if(hold&&demoHeldAt===null)demoHeldAt=performance.now();
   if(!hold&&demoHeldAt!==null){demoPausedFor+=performance.now()-demoHeldAt;demoHeldAt=null;}
  },
  setSound(on){
   muted=!on;applySettings();
   weather({silent:muted||!settings.sfxEnabled});
   if(!on)for(const a of Object.values(audio))a.pause();
  }
 };
}catch(error){console.error(error);app.innerHTML='<main class="screen center"><h2>'+tr('loadError')+'</h2><p>'+tr('loadHttpHint')+'</p></main>';}

function meritCounter(value=readMerit(gameStorage).balance){return `<div class="merit-counter" aria-label="${tr('currentMerit')}">${tr('meritCounter')}<b id="merit-count">${value}</b></div>`;}
function applyCosmetics(){const s=readMerit(gameStorage);document.body.dataset.skin=s.selected.skin;document.body.dataset.board=s.selected.board;document.body.dataset.crest=s.selected.crest;}
function settlementHTML(r){return `<div class="settlement">${r.rows.map(([label,value],i)=>`<div class="merit-row" style="animation-delay:${.65+i*.4}s"><span>${tr(label)}</span><b>+${value}</b></div>`).join('')}</div>`;}
function animateMerit(r){const token=run;let sum=0;const later=(fn,ms)=>setTimeout(()=>{if(run===token)fn();},ms);r.rows.forEach((row,i)=>{for(let step=1;step<=8;step++)later(()=>{$('#merit-total').textContent=tr('meritEarned', [sum+Math.floor(row[1]*step/8)]);if(step===8)sum+=row[1];},650+i*400+step*35);});for(let i=0;i<10;i++)later(()=>{const origin=$('#merit-total').getBoundingClientRect(),target=$('.merit-counter').getBoundingClientRect();const coin=document.createElement('i');coin.className='merit-coin';coin.innerHTML='<svg viewBox="0 0 24 24"><g fill="none" stroke="#805317" stroke-width="1.5"><ellipse cx="12" cy="12" rx="8" ry="5"/><ellipse cx="12" cy="12" rx="5" ry="8"/><circle cx="12" cy="12" r="2"/></g></svg>';coin.style.left=origin.left+origin.width/2+'px';coin.style.top=origin.top+'px';coin.style.setProperty('--coin-x',target.left+target.width/2-origin.left-origin.width/2+'px');coin.style.setProperty('--coin-y',target.top-origin.top+'px');app.appendChild(coin);later(()=>{coin.remove();$('#merit-count').textContent=r.state.balance-r.total+Math.floor(r.total*(i+1)/10);$('#merit-count').animate?.([{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:160});if(i%3===0)sound('coin');},650);},2750+i*65);}
function campPage(tab){const choices=[['skin',tr('tileSkins')],['board',tr('boards')],['crest',tr('crestColors')]];tab=savedTab('camp',choices,tab);const s=readMerit(gameStorage);view(`${meritCounter()}<header class="toolbar"><h2>${tr('camp')}</h2><button id="camp-back">${tr('back')}</button></header><p class="muted">${tr('spendMeritOnCampCosmeticsBattleDifficulty')}</p>${pageTab('camp',choices,tab)}${choices.filter(([kind])=>kind===tab).map(([kind,label])=>`<h3>${label}</h3><div class="camp-grid">${GOODS.filter(g=>g.kind===kind).map(g=>`<button data-good="${g.id}" aria-pressed="${s.selected[kind]===g.id}" ${!s.owned.includes(g.id)&&s.balance<g.price?'disabled':''}>${kind==='skin'?`<span class="skin-sample" data-sample="${g.id}"><img src="${portrait(1)}" alt=""></span>`:''}<b>${tr('good.'+g.id)}</b><small>${s.selected[kind]===g.id?tr('equipped'):s.owned.includes(g.id)?tr('equip'):s.balance<g.price?tr('needMoreMerit'):tr('redeem')}</small><span class="good-description">${tr('goodDescriptionPrice', [kind==='skin'?tr('tileSkin'):kind==='board'?tr('boardBackground'):tr('crestColor'), g.price])}</span></button>`).join('')}</div>`).join('')}<p class="muted">${tr('comingToCampArtMusicAndWarriors')}</p>`,'settings paged camp');bindPageTabs('camp',campPage);$('#camp-back').onclick=deploy;document.querySelectorAll('[data-good]').forEach(b=>b.onclick=()=>{try{if(redeemMerit(gameStorage,b.dataset.good))campPage();else toast(tr('notEnoughMerit'));}catch{toast(tr('couldNotSaveProgress'));}});}

const STRATEGIES={...STRATEGY_POOL,undo:{icon:'undo'},breakout:{icon:'breakout'}};
function strategyText(id){
 return {name:tr('strategy.'+id),help:tr('strategyHelp.'+id),icon:STRATEGIES[id].icon};
}
function icon(id){return `<img class="strategy-icon" src="img/icons/${id}.png" alt="">`;}
function strategyButton(id){const {name,help,icon:asset}=strategyText(id);return `<button id="${id}" aria-label="${name}：${help}" title="${name}：${help}">${icon(asset)}<span>${name}</span><b id="${id}-badge" class="strategy-badge"></b></button>`;}
function badge(id,count){$('#'+id+'-badge').textContent=count;}
function bindStrategyHelp(ids){for(const id of ids){const b=$('#'+id);if(!b)continue;let timer,held=false;const cancel=()=>clearTimeout(timer);b.addEventListener('pointerdown',()=>{held=false;timer=setTimeout(()=>{held=true;toast(`${strategyText(id).name}：${strategyText(id).help}`);},500);});for(const e of ['pointerup','pointercancel','pointerleave'])b.addEventListener(e,cancel);b.addEventListener('click',e=>{if(held){e.stopImmediatePropagation();e.preventDefault();held=false;}},true);b.addEventListener('focus',()=>toast(`${strategyText(id).name}：${strategyText(id).help}`));}}
function strategyHelp(){return `<h3>${tr('stratagemsHoldForDetails')}</h3><p>${tr('gainOneStratagemPerBattleAndCarry')}</p><div class="strategy-help">${Object.keys(STRATEGIES).map(strategyText).map(({name,help,icon:asset})=>`<p>${icon(asset)}<b>${name}</b>：${help}</p>`).join('')}<p>${tr('pauseIconHelp', [icon('pause')])}</p></div><h3>${tr('relaxedMode')}</h3><p>${tr('relaxedRules')}</p>`;}

function choiceDialog(title,choices,next,languageOptions=false){const o=document.createElement('div');o.className='overlay';o.innerHTML=`<div class="dialog choice-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${choices.map(([v,t])=>`<button data-choice="${v}"${languageOptions?` lang="${v}"`: ''}>${esc(t)}</button>`).join('')}<button id="choice-cancel">${tr('back')}</button></div>`;app.appendChild(o);o.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{o.remove();return next(b.dataset.choice);});$('#choice-cancel').onclick=()=>o.remove();}
function battleSettings(){saveSession();const saved=readJSON('sengoku-session',null);remaining=seconds();paused=true;settingsReturn=()=>{if(saved&&saved.relaxed===settings.relaxed)resumeSession(saved);else deploy();};settingsPage();}
function smallTip(key){const message=tr(key);if(tipKeys.has(key)||tipKeys.has(message))return;tipKeys.add(key);const e=document.createElement('div');e.className='small-tip';e.textContent=message;app.appendChild(e);setTimeout(()=>e.remove(),3500);}
function spotlightTutorial(done){remaining=seconds();paused=true;music.pause(true);weather({paused:true});const steps=chapter===1?[['.tile',tr('connectTwoMatchingWarriorsWithUpTo')],['#hint',tr('counselRevealsAMatchingPairYouGain')]]:[[level.siege?'#breakout':level.target||level.duel||level.fire||level.betrayal?'#target':'.tile',level.siege?tr('useBreakOutToOpenAPath'):tr('trackYourBattleObjectivesHere')]] ;let index=0;const show=()=>{const [selector,message]=steps[index],target=$(selector)||$('.tile');target.classList.add('spotlight-target');const o=document.createElement('div');o.className='spotlight-overlay';const rect=target.getBoundingClientRect?.();o.innerHTML=`${rect?`<div class="spotlight-window" style="left:${rect.left-4}px;top:${rect.top-4}px;width:${rect.width+8}px;height:${rect.height+8}px"></div>`:''}<div class="spotlight-card" role="dialog" aria-modal="true"><span class="tutorial-arrow">${index?'↓':'↑'}</span><p>${message}</p><button id="spotlight-next">${tr('gotIt')}</button></div>`;app.appendChild(o);$('#spotlight-next').onclick=()=>{target.classList.remove('spotlight-target');o.remove();if(++index<steps.length)show();else{done();paused=false;started=battleNow();music.pause(false);weather({paused:false});}};};show();}

function syncStrategies(){
 const controls=$('#strategy-controls');
 const ids=Object.keys(STRATEGY_POOL).filter(id=>heldCount(id));
 ids.push('undo');
 if(level.siege)ids.push('breakout');
 const key=ids.join(',');
 if(controls.dataset.buttons!==key){
  controls.dataset.buttons=key;
  controls.innerHTML=ids.map(strategyButton).join('');
  bindStrategyHelp(ids);
  for(const id of ids)$('#'+id).onclick=()=>activateStrategy(id);
 }
 for(const id of ids){
  if(!Object.hasOwn(STRATEGY_POOL,id))continue;
  const button=$('#'+id);
  badge(id,heldCount(id));
  button.disabled=busy||(id==='toki'&&settings.relaxed);
  if(['monomi','shinobi','sougakari'].includes(id))button.setAttribute('aria-pressed',String(armedStrategy===id));
 }
}

const strategyPrompts={
 monomi:'chooseATile',
 shinobi:'chooseTwoMatchingWarriors',
 sougakari:'chooseATile'
};
function showStrategyPrompt(){
 const note=$('#strategy-note');
 note.innerHTML=armedStrategy?`${icon(armedStrategy)}${strategyText(armedStrategy).name}：${armedStrategy==='shinobi'&&strategyFirstId?tr('chooseAnotherTileOfTheSameWarrior'):tr(strategyPrompts[armedStrategy])}`:'';
}
function announceStrategy(){
 const note=$('#strategy-note');
 if(!note)return;
 const {grant}=strategyRun;
 note.innerHTML=tr('stratagemGained', [icon(grant), strategyText(grant).name]);
 setTimeout(()=>{if(note===$('#strategy-note')&&!armedStrategy)note.innerHTML='';},1500);
}
function disarmStrategy(){
 armedStrategy=null;strategyFirstId=0;
 showStrategyPrompt();
}
function spendStrategy(id){
 strategyRun.stock[id]--;
 disarmStrategy();
}
function activateStrategy(id){
 if(busy||paused)return;
 if(id==='undo')return undo();
 if(id==='breakout')return breakout();
 if(!heldCount(id))return;
 if(id==='hint')return showHint();
 if(id==='shuffle')return reshuffle(false);
 if(id==='toki'){
  if(settings.relaxed)return;
  // These deadlines use the countdown's coordinate system. Shift them
  // along with it to preserve the real time until each chapter event.
  remaining=seconds()+15;started=battleNow();
  supplyDue+=15;siegeDue+=15;artilleryDue+=15;
  spendStrategy(id);sound('start');updateHud();saveSession();
  return;
 }
 const cancel=armedStrategy===id;
 armedStrategy=cancel?null:id;
 strategyFirstId=0;selected=-1;
 showStrategyPrompt();syncStrategies();render();saveSession();
}
async function chooseStrategyTile(i){
 const id=armedStrategy;
 const targets=strategyTargets(board,ids,fog,fire?.locked||[],i,id);
 if(!targets.length){sound('bad');return;}
 if(id==='monomi'){
  const tiles=targets.map(j=>$('[data-index="'+j+'"]'));
  spendStrategy(id);sound('hint');
  for(const tile of tiles){
   tile.classList.add('monomi');
   clearTimeout(tile.monomiTimer);
   tile.monomiTimer=setTimeout(()=>tile.classList.remove('monomi'),3000);
  }
  syncStrategies();saveSession();
  return;
 }
 if(id==='shinobi'){
  const first=ids.indexOf(strategyFirstId);
  if(first===i){strategyFirstId=0;selected=-1;showStrategyPrompt();render();saveSession();return;}
  if(!targets.includes(first)){
   strategyFirstId=ids[i];selected=i;
   sound('select');showStrategyPrompt();render();saveSession();return;
  }
  spendStrategy(id);selected=-1;
  return clearTiles([first,i]);
 }
 spendStrategy(id);selected=-1;
 return clearTiles(targets);
}
