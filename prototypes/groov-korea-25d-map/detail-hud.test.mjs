import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {detailHudPadding,mountDetailHud} from './detail-hud.mjs';
import {mountPlaceSearch} from './place-search.mjs';
import {installMapToolIcons} from './map-tool-icons.mjs';
import {mountOrientation} from './map-motion.mjs';
const read=file=>readFile(new URL(file,import.meta.url),'utf8');

test('detail camera leaves a map target between persistent top search and bottom card at phone sizes',()=>{
  for(const [width,height] of [[320,568],[360,640],[390,667],[430,932],[844,390],[320,280]]){
    for(const [top,cardHeight,sheetHeight] of [[190,185,0],[240,210,0],[190,0,300],[300,230,600]]){
      const p=detailHudPadding({width,height,top,cardHeight,sheetHeight});
      assert.ok(p.top>=0&&p.bottom>=0);assert.ok(height-p.top-p.bottom>=83.999);
      assert.ok(width-p.left-p.right>=236);
    }
  }
  assert.ok(detailHudPadding({width:390,height:844,top:210}).top>210);
});

class Element extends EventTarget {
  children=[];attributes={};dataset={};hidden=false;style={setProperty:(key,value)=>this.styles[key]=value};styles={};nodes={};value='';
  constructor(rect={top:0,bottom:200,height:200}){super();this.rect=rect;}
  querySelector(selector){if(this.nodes[selector])return this.nodes[selector];return this.children.find(child=>child.tag===selector)||null;}
  getBoundingClientRect(){return this.rect;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key]??null;}
  append(...children){children.forEach(c=>c.parent=this);this.children.push(...children);}
  replaceChildren(...children){this.children=[];this.append(...children);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  contains(target){return target===this||this.children.includes(target);}
  click(){this.dispatchEvent(new Event('click'));}
  focus(){this.focused=true;}
}

test('HUD measures centered tabs without a tool menu and updates after a viewport change',()=>{
  const previous={matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const mq=new EventTarget();mq.matches=true;
  Object.assign(globalThis,{matchMedia:()=>mq,requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){}});
  try{
    const root=new Element({top:0,bottom:667,height:667});root.clientWidth=390;root.clientHeight=667;
    root.nodes={'.detail-top-controls':new Element({top:68,bottom:218,height:150}),'.view-tabs':new Element({top:68,bottom:156,height:88}),'.map-bottom':new Element({top:448,bottom:643,height:195})};
    const hud=mountDetailHud(root);
    assert.equal(root.styles['--detail-tabs-bottom'],'156px');assert.equal(root.styles['--detail-hud-bottom'],'218px');
    assert.equal(hud.padding().top,230);
    root.nodes['.view-tabs'].rect.bottom=180;root.nodes['.detail-top-controls'].rect.bottom=242;
    mq.matches=false;mq.dispatchEvent(new Event('change'));
    assert.equal(root.styles['--detail-tabs-bottom'],'180px');assert.equal(root.styles['--detail-hud-bottom'],'242px');assert.equal(hud.padding(),null);
    mq.matches=true;mq.dispatchEvent(new Event('change'));assert.equal(hud.padding().top,254);
    hud.destroy();
    root.nodes['.view-tabs'].rect.bottom=300;mq.dispatchEvent(new Event('change'));
    assert.equal(root.styles['--detail-tabs-bottom'],'180px','viewport listener is removed on destroy');
  }finally{Object.assign(globalThis,previous);}
});

test('both maps share an outline square mode icon and keep the previous compass needle',async()=>{
  const root=new Element(),tilt=new Element(),national=new Element(),compass=new Element();
  tilt.setAttribute('aria-label','평면으로 전환');compass.setAttribute('aria-label','방향 초기화');
  root.nodes={'#detail-tilt':tilt,'#tilt-toggle':national,'#detail-compass':compass};
  installMapToolIcons(root);
  assert.equal(tilt.innerHTML,national.innerHTML);
  assert.match(tilt.innerHTML,/<rect x="4" y="4" width="16" height="16" rx="1\.5"\/>/);
  assert.match(tilt.innerHTML,/fill="none".*stroke-width="1\.7"/);
  assert.doesNotMatch(tilt.innerHTML,/<span|<text|2\.5D|평면/);
  for(const [file,id] of [['index.html','tilt-toggle'],['detail.html','detail-tilt']]){
    const button=(await read(file)).split(`id="${id}"`)[1].split('</button>')[0];
    assert.ok(button.includes(tilt.innerHTML),file+' initial square matches runtime icon');
  }
  assert.match(compass.innerHTML,/viewBox="0 0 24 24"/);
  assert.doesNotMatch(compass.innerHTML,/<text|>N</);assert.match(compass.innerHTML,/m12 3 7 17-7-4-7 4 7-17Zm0 0v13/);
  assert.equal(compass.title,'방향 초기화');
});

test('mode icon survives pitch toggles while labels, state and north reset remain functional',()=>{
  const previous=globalThis.document;globalThis.document={body:{dataset:{}}};
  class Map extends EventEmitter {
    pitch=48;bearing=35;
    getPitch(){return this.pitch;}getBearing(){return this.bearing;}stop(){}
    easeTo(next){this.pitch=next.pitch??this.pitch;this.bearing=next.bearing??this.bearing;this.emit('pitch');this.emit('rotate');this.emit('moveend');}
  }
  try{
    const map=new Map(),root=new Element(),tilt=new Element(),compass=new Element();
    root.nodes={'#detail-tilt':tilt};installMapToolIcons(root);
    const icon=tilt.innerHTML;tilt.nodes.svg=new Element();
    const assertIcon=()=>{assert.equal(tilt.innerHTML,icon);assert.equal(tilt.textContent,undefined);};
    mountOrientation(map,tilt,compass);
    assertIcon();assert.equal(compass.styles['--north-angle'],'-35deg');
    tilt.click();assert.equal(map.pitch,0);assert.equal(map.bearing,35);assertIcon();
    assert.equal(tilt.getAttribute('aria-label'),'2.5D로 전환');assert.equal(tilt.getAttribute('aria-pressed'),'false');
    compass.click();assert.equal(map.bearing,0);assert.equal(map.pitch,0);assert.equal(compass.styles['--north-angle'],'0deg');
    tilt.click();assert.equal(map.pitch,48);assertIcon();assert.equal(tilt.getAttribute('aria-label'),'평면으로 전환');
    assert.equal(tilt.getAttribute('aria-pressed'),'true');
    map.easeTo({bearing:-90});assert.equal(compass.styles['--north-angle'],'90deg');
    compass.click();assert.equal(map.bearing,0);assert.equal(map.pitch,48);assertIcon();
    map.easeTo({pitch:0});assert.equal(tilt.getAttribute('aria-pressed'),'false');assertIcon();
    map.easeTo({pitch:35});assert.equal(tilt.getAttribute('aria-pressed'),'true');assertIcon();
  }finally{globalThis.document=previous;}
});

test('flat mode keeps the square and 2.5D mode tilts the same outline on both maps',async()=>{
  const css=await read('mobile-map.css');
  assert.match(css,/#tilt-toggle svg,#detail-tilt svg \{[^}]*transform-origin:center;[^}]*transform:none;/);
  assert.match(css,/#tilt-toggle\[aria-pressed=true\] svg,#detail-tilt\[aria-pressed=true\] svg \{transform:rotateX\(55deg\) rotateZ\(-35deg\);\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\s*#tilt-toggle svg,#detail-tilt svg \{transition:none;\}/);
});

test('course icon is shared across maps and preserves the existing button behavior',async()=>{
  const root=new Element(),national=new Element(),detail=new Element();let clicked=0;
  root.nodes={'#open-course':national,'#course-pin-toggle':detail};
  national.setAttribute('aria-label','이 위치에서 코스 설계');detail.setAttribute('aria-label','핀으로 나만의 코스 만들기');
  detail.setAttribute('aria-pressed','true');detail.addEventListener('click',()=>clicked++);
  installMapToolIcons(root);
  assert.equal(national.innerHTML,detail.innerHTML);
  assert.match(detail.innerHTML,/M7 19h4c4 0 7-3 7-7M22 6/);
  assert.match(detail.innerHTML,/stroke-width="1\.7"/);
  assert.equal(detail.getAttribute('aria-pressed'),'true');detail.click();assert.equal(clicked,1);
  const geometry=detail.innerHTML.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];
  for(const file of ['index.html','detail.html'])assert.ok((await read(file)).includes(geometry),file+' initial icon matches runtime icon');
});

test('a blocked search selection leaves results open and does not falsely label a selected place',()=>{
  const previous=globalThis.document;
  globalThis.document={createElement(tag){const el=new Element();el.tag=tag;return el;}};
  try{
    const host=new Element(),input=new Element(),status=new Element(),list=new Element();
    host.nodes={form:new Element(),input,p:status,ul:list,'label span':new Element()};
    let allowed=false,selected=0;
    mountPlaceSearch(host,{localResults:()=>[{name:'중앙동',address:'울산광역시 중구 중앙동'}],onSelect:()=>{if(!allowed)return false;selected++;}});
    input.value='중앙동';input.dispatchEvent(new Event('input'));
    list.children[0].children[0].click();
    assert.equal(list.hidden,false);assert.equal(status.hidden,true);assert.equal(selected,0);
    allowed=true;list.children[0].children[0].click();
    assert.equal(list.hidden,true);assert.equal(selected,1);assert.equal(status.textContent,'선택한 위치: 울산광역시 중구 중앙동');
  }finally{globalThis.document=previous;}
});

test('course-map bottom score board matches the national dark material on desktop and phone',async()=>{
  const [detail,national]=await Promise.all(['detail-hud.css','national-hud.css'].map(read));
  const declarations=body=>Object.fromEntries(body.split(';').filter(Boolean).map(pair=>{
    const colon=pair.indexOf(':');return [pair.slice(0,colon).trim(),pair.slice(colon+1).trim()];
  }));
  const reference=declarations(national.match(/\.game-shell \.ranking-panel \{([^}]+)\}/)[1]);
  const rules=[...detail.matchAll(/\.detail-shell \.area-card \{([^}]+)\}/g)];
  assert.ok(rules[0].index<detail.indexOf('@media'),'same surface applies to desktop and mobile');
  const base=declarations(rules[0][1]);
  for(const key of ['border','border-left','border-radius','background','box-shadow','backdrop-filter','-webkit-backdrop-filter']){
    assert.equal(base[key],reference[key],key);
    for(const rule of rules.slice(1))assert.equal(declarations(rule[1])[key],undefined,'responsive rules change spacing, not '+key);
  }
  assert.equal(base['pointer-events'],'auto');
  assert.match(detail,/\.detail-shell \.area-card \{padding:12px;\}/);
  assert.match(detail,/\.map-bottom \{display:block!important[^}]*bottom:calc\(24px \+ env\(safe-area-inset-bottom/);
});

test('persistent search/card are not inert sheets and all zoom, route and card IDs stay unique',async()=>{
  const [html,js,css,toolbar]=await Promise.all(['detail.html','detail.js','detail-hud.css','map-toolbar.css'].map(read));
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const id of ['detail-zoom-in','detail-zoom-out','zoom-value','course-pin-toggle','detail-tilt','detail-compass','area-name','area-score','area-ranking','gps-start','gps-stop'])assert.ok(ids.includes(id),id);
  assert.doesNotMatch(html+js,/id="verified-neighborhood"|mountVerifiedNeighborhood|인증 동네 연결/);
  assert.doesNotMatch(html+js+css,/detail-tools-toggle|detail-tool-menu|closeTools|북쪽을 위로/);
  const actions=html.split('<div class="map-actions"')[1].split('<aside')[0];
  assert.match(actions,/id="detail-tilt"/);assert.match(actions,/id="detail-compass"/);
  assert.doesNotMatch(actions,/<[^>]*\shidden(?:\s|=|>)/);
  const tabs=html.split('<nav class="view-tabs"')[1].split('</nav>')[0];assert.equal((tabs.match(/<button/g)||[]).length,2);
  for(const number of ['01','02'])assert.ok(tabs.includes(`<span>${number}</span>`));
  assert.doesNotMatch(tabs,/<small>/);
  assert.match(css,/\.view-tabs button \{[^}]*align-items:center;justify-content:center[^}]*text-align:center/);
  assert.match(css,/\.view-tabs button>span \{display:block/);
  assert.match(css,/\.view-tabs button \{[^}]*flex-direction:row[^}]*min-height:36px/);
  assert.doesNotMatch(css,/\.view-tabs button(?:>span| small)\s*\{[^}]*display:none/);
  assert.doesNotMatch(js,/search:\{element|info:\{element|mobileUI\?\.open\(['"]info/);
  assert.match(js,/actions:\[\]/);assert.match(js,/beforeSearchSelect/);assert.match(js,/mode==='live'/);
  assert.match(css,/\.detail-top-controls \.view-tabs [^}]*transform:none/);
  assert.match(css,/background:rgb\(16 20 21 \/ 62%\)/);
  assert.match(css,/\.detail-top-controls \{[^}]*pointer-events:none/);
  assert.match(css,/\.detail-top-controls \.view-tabs,\.detail-top-controls \.area-search \{pointer-events:auto/);
  assert.match(toolbar,/\.map-actions>\.zoom-control \{\s*display:grid!important/);
  assert.match(toolbar,/\.zoom-control output \{\s*display:block/);
  assert.match(css,/body\[data-view=run\] \.detail-shell \.map-bottom/);
  assert.match(css,/\.detail-shell \.map-bottom \{display:block!important[^}]*left:12px/);
});

test('both maps use the same visible Street Atlas brand next to GROOV, including embedded full maps',async()=>{
  const [index,detail,brand,host]=await Promise.all(['index.html','detail.html','map-brand.css','app-host.css'].map(read));
  for(const html of [index,detail]){
    assert.match(html,/href="map-brand.css"/);
    const header=html.match(/<header[\s\S]*?<\/header>/)[0];
    assert.match(header,/map-brand-name[^>]*>GROOV<\//);
    assert.match(header,/class="map-brand-divider" aria-hidden="true"/);
    assert.match(header,/class="map-brand-meta">STREET ATLAS <span>2\.5D<\/span>/);
  }
  assert.match(brand,/map-brand-meta span \{display:inline!important;color:#ff5733/);
  assert.match(brand,/data-compact=true\] \.map-header \{display:none!important/);
  assert.doesNotMatch(host,/html\[data-embedded\] \.(top-hud|detail-header),/);
});

test('course heading precedes thin tabs, search and persistent administrative hint',async()=>{
  const [html,js,css]=await Promise.all(['detail.html','detail.js','detail-hud.css'].map(read));
  const start=html.indexOf('class="detail-top-controls"'), heading=html.indexOf('class="place-heading"'),tabs=html.indexOf('class="view-tabs"'),search=html.indexOf('id="area-search"'),hint=html.indexOf('class="view-status"');
  assert.ok(start<heading && heading<tabs && tabs<search && search<hint);
  assert.match(html,/id="view-eyebrow">01 \/ KOREA · EXPLORE</);
  assert.match(html,/id="view-title">코스탐색</);
  assert.match(js,/explore: \{\s*title: "코스탐색"/);
  assert.match(html.slice(hint),/시·군·구 → 읍·면·동/);
  assert.match(html,/<span id="view-status" hidden><\/span>/);
  assert.match(css,/\.place-heading \{display:block!important;position:static/);
  for(const rule of css.matchAll(/\.view-tabs button \{([^}]+)\}/g))assert.match(rule[1],/min-height:36px/);
  assert.match(css,/width:calc\(100% - 80px\)/);
});

test('compact search and tabs share the marked width while both maps shrink only the atlas subtitle',async()=>{
  const [css,brand]=await Promise.all(['detail-hud.css','map-brand.css'].map(read));
  assert.match(css,/--detail-input-width:min\(100%,380px\)/);
  assert.match(css,/--detail-input-width:min\(100%,260px\)/);
  for(const selector of ['view-tabs','area-search']){
    assert.match(css,new RegExp('\\.detail-top-controls \\.'+selector+' \\{[^}]*width:var\\(--detail-input-width\\)'));
  }
  assert.match(css,/\.place-search-form input \{height:36px[^}]*font-size:16px/);
  assert.match(css,/data-mobile-keyboard=true\] \.area-search \{width:100%/);
  assert.match(brand,/\.map-brand-meta \{[^}]*font:750 11px\/1\.2/);
  assert.match(brand,/@media\(max-width:760px\)\{[\s\S]*?\.map-brand-meta \{font-size:9px/);
  assert.match(brand,/\.map-brand-name \{font-size:30px/);
});
