import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {mountNationalHud,nationalCameraPadding} from './national-hud.mjs';
import {mountRankingHeat,RANKING_HEAT_COLOR} from './ranking-heat.mjs';
import {formatPoints,classifyHeat} from './model.mjs';
const read=file=>readFile(new URL(file,import.meta.url),'utf8');
const require=createRequire(new URL('../../apps/mobile/package.json',import.meta.url));
const ts=require('typescript'),app=await read('app.js');
const source=ts.createSourceFile('app.js',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const functions=names=>source.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name.text)).map(node=>node.getText(source)).join('\n');

class Element extends EventTarget {
  attributes={};dataset={};children=[];nodes={};hidden=false;inert=false;focused=false;classes=new Set();
  classList={toggle:(key,value)=>{if(value)this.classes.add(key);else this.classes.delete(key);}};
  setAttribute(k,v){this.attributes[k]=v;}
  querySelector(s){return this.nodes[s]||null;}
  querySelectorAll(){return this.children;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  contains(target){return this===target||this.children.includes(target);}
  click(){this.dispatchEvent(new Event('click'));}
  focus(){this.focused=true;}
  getBoundingClientRect(){return {height:this.classes.has('is-collapsed')?64:300};}
}
function setup(options){
  const root=new Element();root.clientWidth=390;root.clientHeight=844;
  for(const id of ['ranking-panel','ranking-content','ranking-toggle','ranking-minimize','ranking-close','region-menu','region-toggle','region-short-code','region-current-name'])root.nodes['#'+id]=new Element();
  for(const [key,short,name] of [['korea','KR','전국'],['seoul','SL','서울'],['jeju','JJ','제주']]){
    const button=new Element();button.dataset.region=key;button.nodes={span:{textContent:short},b:{textContent:name}};
    root.nodes['#region-menu'].children.push(button);
  }
  return {root,ui:mountNationalHud(root,options),get:id=>root.nodes['#'+id]};
}

test('national map starts clean; switching popups preserves ranking mode and restores its box',()=>{
  const {ui,get}=setup();assert.equal(ui.current,null);assert.ok(get('ranking-panel').hidden&&get('region-menu').hidden);
  get('ranking-toggle').click();assert.equal(ui.current,'ranking');assert.equal(get('ranking-panel').inert,false);
  get('region-toggle').click();assert.equal(ui.current,'regions');assert.ok(get('ranking-panel').hidden);assert.equal(get('ranking-toggle').attributes['aria-expanded'],'false');
  assert.equal(ui.rankingMode,true);assert.equal(get('ranking-toggle').attributes['aria-pressed'],'true');
  get('region-toggle').click();assert.equal(ui.current,'ranking');assert.equal(get('ranking-panel').hidden,false);
  assert.equal(get('region-toggle').attributes['aria-expanded'],'false');
});

test('ranking mode controls actual map tint; minimizing and region selection never restore base paint',()=>{
  const paints={'fill-color':'#171c1e','fill-opacity':.04},original=structuredClone(paints);
  const map={getLayer:()=>true,getPaintProperty:(_,key)=>paints[key],setPaintProperty:(_,key,value)=>{paints[key]=value;}};
  const heat=mountRankingHeat(map,['areas']);
  const heatStates=[];
  const {ui,get,root}=setup({onRankingModeChange:enabled=>{heatStates.push(enabled);heat.setEnabled(enabled);}});
  get('ranking-toggle').click();assert.deepEqual(paints['fill-color'],RANKING_HEAT_COLOR);
  get('ranking-minimize').click();get('region-toggle').click();get('region-menu').children[1].click();
  assert.deepEqual(heatStates,[false,true]);assert.deepEqual(paints['fill-color'],RANKING_HEAT_COLOR);
  assert.equal(get('ranking-content').hidden,true,'region navigation remembers the minimized box');
  get('ranking-minimize').click();
  const escape=new Event('keydown',{cancelable:true});Object.defineProperty(escape,'key',{value:'Escape'});root.dispatchEvent(escape);
  assert.equal(ui.rankingMode,true);assert.deepEqual(heatStates,[false,true]);
  root.dispatchEvent(escape);assert.equal(ui.rankingMode,false);assert.deepEqual(paints,original);
  ui.open('ranking');get('ranking-close').click();assert.deepEqual(paints,original);
  ui.open('ranking');get('ranking-toggle').click();assert.deepEqual(paints,original);
  ui.open('ranking');ui.close();assert.deepEqual(paints,original);
});

test('minus collapses only box content, plus restores it and camera padding matches the visible header',()=>{
  const {ui,get,root}=setup();get('ranking-toggle').click();
  assert.equal(ui.padding().bottom,328);
  get('ranking-minimize').click();
  assert.equal(ui.rankingMode,true);assert.equal(get('ranking-panel').hidden,false);
  assert.equal(get('ranking-content').hidden,true);assert.equal(get('ranking-content').inert,true);
  assert.equal(get('ranking-toggle').attributes['aria-pressed'],'true');
  assert.equal(get('ranking-toggle').attributes['aria-expanded'],'false');
  assert.equal(get('ranking-minimize').textContent,'+');
  assert.equal(get('ranking-minimize').attributes['aria-label'],'랭킹 박스 펼치기');
  assert.equal(root.dataset.rankingExpanded,'false');assert.equal(ui.padding().bottom,92);
  get('ranking-minimize').click();
  assert.equal(get('ranking-content').hidden,false);assert.equal(get('ranking-content').inert,false);
  assert.equal(get('ranking-minimize').textContent,'−');
  assert.equal(get('ranking-minimize').attributes['aria-expanded'],'true');assert.equal(ui.padding().bottom,328);
  get('ranking-minimize').click();ui.open('ranking');
  assert.equal(get('ranking-content').hidden,false,'selecting a district reopens its ranking details');
});

test('region-menu dismissal retains expanded or collapsed ranking state without disabling heat',()=>{
  const {ui,get,root}=setup();ui.open('ranking');
  get('region-toggle').click();assert.equal(ui.padding().bottom,62);
  root.dispatchEvent(new Event('pointerdown'));
  assert.equal(ui.current,'ranking');assert.equal(get('ranking-content').hidden,false);
  get('ranking-minimize').click();get('region-toggle').click();ui.closeRegionMenu();
  assert.equal(ui.rankingMode,true);assert.equal(get('ranking-content').hidden,true);
});

test('region menu invokes navigation, updates its original code/name and closes; blocked navigation stays open',()=>{
  let ready=false;const calls=[];
  const {ui,get}=setup({onRegionSelect:key=>{calls.push(key);return ready;}});
  get('region-toggle').click();get('region-menu').children[1].click();assert.equal(ui.current,'regions');assert.equal(get('region-current-name').textContent,'전국');
  ready=true;get('region-menu').children[1].click();assert.equal(ui.current,null);
  assert.equal(get('region-current-name').textContent,'서울');assert.equal(get('region-short-code').textContent,'SL');
  assert.equal(get('region-menu').children[1].attributes['aria-pressed'],'true');assert.deepEqual(calls,['seoul','seoul']);
});

test('Escape, close button and outside tap dismiss overlays without blocking the map',()=>{
  const {root,ui,get}=setup();get('ranking-toggle').click();get('ranking-close').click();
  assert.equal(ui.current,null);assert.equal(get('ranking-toggle').focused,true);
  get('region-toggle').click();const escape=new Event('keydown',{cancelable:true});Object.defineProperty(escape,'key',{value:'Escape'});root.dispatchEvent(escape);
  assert.equal(ui.current,null);assert.equal(get('region-toggle').focused,true);assert.ok(escape.defaultPrevented);
  get('region-toggle').click();root.dispatchEvent(new Event('pointerdown'));assert.equal(ui.current,null);
});

test('national camera padding leaves at least 90px of map visible above the bottom popup on phones',()=>{
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[320,280],[1440,900]])for(const panelHeight of [0,250,480,800]){
    const p=nationalCameraPadding({width,height,panelHeight});assert.ok(height-p.top-p.bottom>=89.999);assert.ok(width-p.left-p.right>210);
  }
});

test('clicking a ranking row selects its district, opens bottom ranking and moves the camera with safe padding',()=>{
  const district={code:'11040',province:'서울',name:'성동구',center:[127.04,37.55],feature:{type:'Feature'},rank:3,score:997400,participationRate:62.8,todayDelta:2481,heat:.9};
  const moves=[],filters=[],panels=[];
  const context={embedded:false,sendApp(){},document:{createElement:()=>new Element()},dom:{'ranking-list':new Element()},previousRanks:new Map(),selectedCode:null,activeRegion:'korea',
    currentRanking:()=>[district],districtByCode:new Map([[district.code,district]]),formatPoints,classifyHeat,
    renderSelection(){},outlinePulse(){},nationalHUD:{open:key=>panels.push(key)},
    map:{setFilter:(...args)=>filters.push(args),getZoom:()=>6,easeTo:options=>moves.push(options)},
    orientation:{camera:()=>({pitch:48,bearing:-12})},responsivePadding:()=>({top:90,bottom:328,left:24,right:78}),cinematicEase:x=>x};
  vm.createContext(context);vm.runInContext(functions(['renderRanking','selectDistrict']),context);
  context.renderRanking([district],false);context.dom['ranking-list'].children[0].children[0].click();
  assert.equal(context.selectedCode,district.code);assert.equal(panels.at(-1),'ranking');
  assert.equal(moves[0].center,district.center);assert.equal(moves[0].padding.bottom,328);assert.equal(moves[0].pitch,48);assert.equal(moves[0].bearing,-12);
  assert.equal(filters.length,2);assert.ok(context.dom['ranking-list'].children[0].children[0].innerHTML.includes('PT'));
});

test('choosing the same region again recentres it; other region uses its actual bounds',()=>{
  const moves=[];
  const context={REGIONS:{korea:{name:'전국',center:[127,36],zoom:5.38},seoul:{name:'서울',bounds:[[126.76,37.41],[127.2,37.72]]}},
    map:{getLayer:()=>true,flyTo:options=>moves.push(options),fitBounds:(bounds,options)=>moves.push({bounds,options})},
    orientation:{camera:()=>({pitch:0,bearing:12})},nationalHUD:{closeRegionMenu(){},setRegion(){}},activeRegion:'korea',selectedCode:null,
    currentRanking:()=>[],districtByCode:new Map(),outlinePulse(){},applyActiveFilters(){},updateLeagueScene(){},triggerSkin(){},responsivePadding:()=>({top:90,bottom:62,left:24,right:78}),cinematicEase:x=>x,showToast(){}};
  vm.createContext(context);vm.runInContext(functions(['setRegion']),context);
  context.setRegion('korea');assert.equal(moves.length,1);assert.equal(moves[0].pitch,0);
  context.setRegion('seoul');assert.equal(moves[1].bounds,context.REGIONS.seoul.bounds);assert.equal(context.activeRegion,'seoul');
});

test('ranking sheet stays compact while content scrolls and header actions remain available',async()=>{
  const css=await read('national-hud.css');
  const limits=[...css.matchAll(/\.game-shell \.ranking-panel \{[^}]*max-height:min\((\d+)dvh,(\d+)px\)/g)].map(m=>[Number(m[1]),Number(m[2])]);
  assert.deepEqual(limits,[[38,360],[36,300]]);
  for(const [percent,cap] of limits)for(const height of [390,568,667,844,932,1080]){
    const panelHeight=Math.min(height*percent/100,cap);
    assert.ok(panelHeight<=height*.38,'at least 62% of map height remains outside the sheet');
    assert.ok(panelHeight<Math.min(height*.57,540));
  }
  assert.match(css,/\.ranking-content \{min-height:0;overflow:auto;overscroll-behavior:contain/);
  assert.match(css,/\.ranking-panel>header \{[^}]*flex-shrink:0/);
  assert.match(css,/\.ranking-header-actions button \{[^}]*width:44px;height:44px/);
});

test('ranking map naming retains routes and compact region controls use opaque dark surfaces',async()=>{
  const [index,detail,css]=await Promise.all(['index.html','detail.html','national-hud.css'].map(read));
  assert.match(index,/<title>GROOV · 랭킹지도<\/title>/);
  assert.match(index,/aria-label="GROOV 랭킹지도"/);
  assert.match(index,/class="map-brand-meta">STREET ATLAS <span>2\.5D<\/span>/);
  assert.match(detail,/<a class="national-link" href="\.\/">랭킹지도 ↗<\/a>/);
  assert.doesNotMatch(detail,/전국 지도/);
  assert.match(index,/id="region-current-name">전국<\/b>/,'nationwide remains a geographic selection');
  assert.match(css,/\.region-button \{[^}]*height:44px;min-height:44px;padding:0 10px/);
  const widths=[...css.matchAll(/\.national-region-switcher \{[^}]*width:(\d+)px/g)].map(m=>Number(m[1]));
  assert.deepEqual(widths,[112,112]);
  assert.match(css,/\.region-button \{background:#101112;[^}]*backdrop-filter:none/);
  assert.match(css,/\.region-button.is-active \{background:#171310;/);
});

test('region preview fits the entire image in both desktop and narrow phone frames without cropping',async()=>{
  const css=await read('national-hud.css');
  const imageRules=[...css.matchAll(/\.game-shell \.ranking-panel \.selection-image img \{([^}]+)\}/g)];
  assert.equal(imageRules.length,1,'one shared image fit rule covers desktop and phone');
  const rule=imageRules[0][1];
  assert.match(rule,/display:block/);assert.match(rule,/width:100%;height:100%/);
  assert.match(rule,/object-fit:contain/);assert.match(rule,/object-position:center/);
  assert.doesNotMatch(rule,/object-fit:cover|transform:/);
});

test('original region buttons and selected-region card are reused; obsolete height and verification controls are absent',async()=>{
  const [html,detail,detailJs,css]=await Promise.all(['index.html','detail.html','detail.js','national-hud.css'].map(read));
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  assert.match(html,/id="ranking-panel"[^>]*hidden/);assert.match(html,/id="region-menu"[^>]*hidden/);
  assert.match(html,/id="ranking-toggle" aria-label="랭킹"/);
  for(const region of ['korea','seoul','gyeonggi','gangwon','chungcheong','jeolla','gyeongsang','jeju'])assert.ok(html.includes(`data-region="${region}"`));
  const panel=html.split('<aside class="ranking-panel"')[1].split('</aside>')[0];
  assert.match(panel,/id="selection-card"/);assert.match(panel,/id="selection-image"/);assert.match(panel,/id="ranking-list"/);
  assert.match(panel,/id="ranking-minimize"[^>]*aria-controls="ranking-content"/);
  assert.match(panel,/id="ranking-close"[^>]*aria-label="랭킹 모드 종료"/);
  assert.match(panel,/class="ranking-content" id="ranking-content"/);
  assert.match(css,/#ranking-toggle\[aria-pressed=true\]/);
  assert.match(css,/\.ranking-panel \{[^}]*border-left:3px solid #ff5733;[^}]*border-radius:0;[^}]*rgb\(12 13 14 \/ 97%\),rgb\(18 17 17 \/ 96%\)/);
  assert.doesNotMatch(css,/\.ranking-panel \{[^}]*border-radius:(?!0)[0-9]+px/);
  assert.match(css,/\.ranking-content \{[^}]*min-height:0;overflow:auto/);
  assert.match(css,/\.ranking-content\[hidden\] \{display:none!important/);
  assert.match(css,/\.ranking-header-actions button \{[^}]*width:44px;height:44px/);
  assert.doesNotMatch(html+detail+app+detailJs,/id="verified-neighborhood"|mountVerifiedNeighborhood|id="score-height"|점수 높이 보기/);
  assert.doesNotMatch(app,/mountMobileMapUI|mobileUI|scoreHeight/);
  assert.match(app,/selectDistrict\(code, \{ animateCamera: true/);
  assert.match(css,/\.national-region-switcher \{position:absolute;top:94px;left:26px;right:auto/);
  assert.match(css,/background:#101112;/);
  const rankButton=html.match(/<button[^>]*id="ranking-toggle"[^>]*>([\s\S]*?)<\/button>/)[1];
  assert.match(rankButton,/<svg/);assert.doesNotMatch(rankButton,/랭킹|<span/);
  assert.match(css,/\.ranking-panel \{[^}]*top:auto[^}]*bottom:calc\(20px \+ env\(safe-area-inset-bottom/);
  assert.match(css,/\.region-rail\[hidden\],\.game-shell \.ranking-panel\[hidden\] \{display:none!important/);
  assert.match(css,/grid-template-columns:26px minmax\(0,1fr\)/);
});
