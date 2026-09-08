import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { mountCoursePanel } from './course-panel.mjs';
import { mountCoursePlanner } from './course-planner.mjs';
import { mountMobileMapUI } from './mobile-map-ui.mjs';
const read = file => readFile(new URL(file, import.meta.url), 'utf8');

// A small DOM double exercises real planner listeners without a browser or API writes.
class Element extends EventTarget {
  children=[];dataset={};attributes={};hidden=false;inert=false;value='';scrollTop=0;
  constructor(tag='div'){super();this.tag=tag;}
  setAttribute(key,value){this.attributes[key]=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  get id(){return this.getAttribute('id')||'';}set id(value){this.setAttribute('id',value);}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  prepend(...children){for(const child of children)child.parent=this;this.children.unshift(...children);}
  replaceChildren(...children){this.children=[];this.append(...children);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  contains(target){return this===target||this.children.some(c=>c.contains(target));}
  matches(selector){return selector.startsWith('#')?this.id===selector.slice(1):selector.startsWith('.')?(this.getAttribute('class')||'').split(' ').includes(selector.slice(1)):selector==='[data-sport]'?Boolean(this.dataset.sport):this.tag===selector;}
  querySelectorAll(selector){const [first,...rest]=selector.split(' '),found=this.children.flatMap(c=>[...(c.matches(first)?[c]:[]),...c.querySelectorAll(first)]);return rest.length?found.flatMap(c=>c.querySelectorAll(rest.join(' '))):found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  set innerHTML(html){
    this.html=html;this.children=[];const stack=[this];
    for(const match of html.matchAll(/<\/?([\w-]+)\b([^>]*?)>/g)){
      if(match[0].startsWith('</')){stack.pop();continue;}
      const el=new Element(match[1]);
      for(const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))el.setAttribute(attr[1],attr[2]??'');
      el.hidden=el.getAttribute('hidden')!==null;el.checked=el.getAttribute('checked')!==null;el.disabled=el.getAttribute('disabled')!==null;el.value=el.getAttribute('value')||'';
      stack.at(-1).append(el);
      if(!['input','br','img','hr','meta','link'].includes(el.tag)&&!match[0].endsWith('/>'))stack.push(el);
    }
  }
  get innerHTML(){return this.html;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  focus(){document.activeElement=this;}
  getBoundingClientRect(){return {height:200};}
}

function harness(t,mobile=true){
  const saved=Object.fromEntries(['document','matchMedia','maplibregl','fetch'].map(k=>[k,globalThis[k]]));
  const mq=new EventTarget();mq.matches=mobile;
  const body=new Element();body.classList={toggle(){}};
  const markers=[],requests=[];
  class Marker extends EventEmitter {
    constructor({element}){super();this.element=element;markers.push(this);}
    setLngLat(p){this.point=p;return this;}addTo(){return this;}remove(){this.removed=true;}
    getLngLat(){return {lng:this.point[0],lat:this.point[1]};}
  }
  const route={distanceMeters:1000,coordinates:[[127.02,37.65],[127.025,37.655]],pins:[[127.02,37.65],[127.025,37.655]],sport:'running'};
  Object.assign(globalThis,{
    document:{body,activeElement:null,createElement:tag=>new Element(tag)},matchMedia:()=>mq,maplibregl:{Marker},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url==='/api/courses'?{courses:[]}:{...route}};},
  });
  t.after(()=>Object.assign(globalThis,saved));
  return {mq,markers,requests,route};
}

test('mobile defaults to live summary; expanding/folding preserves form data and focus',t=>{
  const {mq}=harness(t);const host=new Element();
  host.innerHTML='<div class="course-panel-body"><div id="course-options"><input id="name"></div></div><button id="course-options-toggle"><span></span></button>';
  const ui=mountCoursePanel(host),options=host.querySelector('#course-options'),toggle=host.querySelector('#course-options-toggle'),name=host.querySelector('#name');
  name.value='우이천 저녁';
  assert.equal(options.hidden,true);assert.equal(options.inert,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  toggle.click();assert.equal(options.hidden,false);assert.equal(options.inert,false);
  name.focus();ui.showPin();assert.equal(document.activeElement,toggle);assert.equal(options.hidden,true);assert.equal(name.value,'우이천 저녁');
  assert.equal(host.querySelector('.course-panel-body').scrollTop,0);
  mq.matches=false;mq.dispatchEvent(new Event('change'));assert.equal(options.hidden,false);assert.equal(options.inert,false);
  mq.matches=true;mq.dispatchEvent(new Event('change'));assert.equal(options.hidden,true);assert.equal(name.value,'우이천 저녁');
  ui.destroy();toggle.click();assert.equal(options.hidden,true);
});

test('course panel owns one close header; mobile manager still controls open/inert state',t=>{
  harness(t);const root=new Element(),host=new Element();host.append(new Element('header'));
  const ui=mountMobileMapUI({root,panels:{course:{element:host,title:'나만의 코스',ownHeader:true}},actions:[]});
  assert.equal(host.children.length,1);assert.equal(host.inert,true);
  ui.open('course');assert.equal(host.inert,false);assert.equal(host.dataset.mobileOpen,'true');
  ui.close();assert.equal(host.inert,true);
});

test('real planner keeps plotting, pin edits, return mode, distance, undo and fit live while folded',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let planner;t.after(()=>planner?.toggle(false));
  const {markers,requests}=harness(t);
  class Map extends EventEmitter {
    sources={};container=new Element();
    getContainer(){return this.container;}getCenter(){return {lng:127.02,lat:37.65};}
    addSource(id,source){this.sources[id]={...source,setData(data){this.data=data;}};}
    getSource(id){return this.sources[id];}addLayer(){}setLayoutProperty(){}
    fitBounds(bounds,options){this.fit={bounds,options};}easeTo(){}
  }
  const map=new Map(),host=new Element(),button=new Element('button'),toggles=[];
  const padding={top:218,bottom:242,left:16,right:68};
  planner=mountCoursePlanner(map,{host,button,camera:()=>({pitch:38,bearing:-12}),padding:()=>padding,onToggle:active=>toggles.push(active)});
  const $=id=>host.querySelector('#'+id),pin=(lng,lat)=>map.emit('click',{lngLat:{lng,lat}});
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  button.click();assert.equal(planner.active,true);assert.equal($('course-options').hidden,true);
  $('course-options-toggle').click();$('course-name').value='우이천 저녁';
  pin(127.02,37.65);pin(127.025,37.655);
  assert.equal(planner.active,true);assert.equal($('course-options').hidden,true);assert.match($('course-pins').textContent,/2\/30/);
  t.mock.timers.tick(751);await flush();assert.equal($('course-distance').textContent,'1.00');assert.equal($('course-save').disabled,false);
  $('course-options-toggle').click();assert.equal($('course-name').value,'우이천 저녁');
  const latest=()=>markers.filter(m=>!m.removed);
  latest()[1].element.click();assert.equal($('course-pin-editor').hidden,false);assert.equal($('course-options').hidden,true);assert.equal(host.dataset.courseEditing,'true');
  $('pin-turn').click();assert.match($('course-pins').textContent,/왕복/);assert.equal($('course-no-return').hidden,false);
  $('course-no-return').click();assert.doesNotMatch($('course-pins').textContent,/왕복/);
  latest()[1].emit('dragstart');latest()[1].setLngLat([127.03,37.66]);latest()[1].emit('dragend');
  t.mock.timers.tick(751);await flush();
  const payload=JSON.parse(requests.filter(r=>r.url==='/api/maps/route').at(-1).options.body);
  assert.deepEqual(payload.pins[1],[127.03,37.66]);
  $('course-fit').click();assert.deepEqual(map.fit.options.padding,padding);assert.equal(map.fit.options.pitch,38);
  $('course-undo').click();assert.match($('course-pins').textContent,/1\/30/);assert.equal($('course-save').disabled,true);
  pin(127.03,37.66);latest()[1].element.click();$('pin-remove').click();assert.match($('course-pins').textContent,/1\/30/);
  $('course-close').click();assert.equal(planner.active,false);
  button.click();assert.match($('course-pins').textContent,/1\/30/);assert.equal($('course-name').value,'우이천 저녁');
  assert.deepEqual(toggles,[true,false,true]);
  assert.ok(requests.every(r=>r.options?.method!=='DELETE'&&(r.url!=='/api/courses'||!r.options)));
});

test('phone CSS pins the summary/actions and scrolls only details inside a bounded safe-area card',async()=>{
  const [css,html,planner]=await Promise.all(['course-panel.css','detail.html','course-planner.mjs'].map(read));
  assert.match(html,/detail-hud\.css[\s\S]*course-panel\.css/);
  assert.match(css,/right:66px/);assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/\.course-panel-body \{min-height:0;overflow:auto;overscroll-behavior:contain/);
  assert.match(css,/course-summary \{flex:0 0 auto/);assert.match(css,/course-quick-actions \{flex:0 0 auto/);
  assert.match(css,/data-mobile-keyboard=true/);assert.match(css,/max-height:540px/);
  assert.match(css,/min-height:44px/);assert.match(css,/course-pin-editor>div \{grid-template-columns:1\.4fr 1fr 44px/);
  const ids=[...planner.split('host.innerHTML = `')[1].split('`;')[0].matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const [height,top,safe] of [[568,218,0],[640,218,24],[844,218,34],[932,230,34]]){
    const compact=Math.min(280,height*.42,height-top-140-safe);
    const expanded=Math.min(500,height*.56,height-top-100-safe);
    assert.ok(compact>=150);assert.ok(height-top-compact-24-safe>=116);
    assert.ok(height-top-expanded-24-safe>=76);
  }
});
