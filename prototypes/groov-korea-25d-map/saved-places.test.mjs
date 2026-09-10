import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { mountSavedPlaces } from './saved-places.mjs';

class Element extends EventTarget {
  children=[];nodes={};dataset={};attributes={};hidden=false;open=false;value='';
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key];}
  append(...nodes){this.children.push(...nodes);}
  querySelector(selector){return this.nodes[selector]??=new Element();}
  replaceChildren(...nodes){this.children=nodes;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
  remove(){this.removed=true;}
  focus(){}
}

test('activation arms the map, tap drops a pin before opening, and save uses the tap rather than map center',async()=>{
  const previous={document:globalThis.document,localStorage:globalThis.localStorage,maplibregl:globalThis.maplibregl,matchMedia:globalThis.matchMedia,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  const doc=new Element();doc.body=new Element();doc.querySelector=()=>null;doc.createElement=()=>new Element();
  const storage=new Map(),markers=[],timers=new Map();let timerId=0;
  globalThis.document=doc;globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  globalThis.matchMedia=()=>({matches:false});
  globalThis.setTimeout=(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;};
  globalThis.clearTimeout=id=>timers.delete(id);
  globalThis.maplibregl={Marker:class {
    constructor(options){this.options=options;markers.push(this);}
    setLngLat(point){this.point=point;return this;}addTo(){return this;}remove(){this.removed=true;}
  }};
  try{
    const map=new EventEmitter(),container=new Element(),rail=new Element();rail.querySelector=()=>null;
    map.getContainer=()=>container;map.getCenter=()=>{throw new Error('must not use map center');};
    const mounted=mountSavedPlaces(map,rail),toggle=rail.children[0],dialog=doc.body.children[0];
    const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
    await flush();toggle.onclick();await flush();
    assert.equal(dialog.open,false);assert.equal(container.dataset.savedPlacePicking,'true');
    assert.equal(toggle.getAttribute('aria-pressed'),'true');
    map.emit('click',{lngLat:{lng:127.02,lat:37.52}});
    assert.equal(dialog.open,false);assert.deepEqual(markers.at(-1).point,[127.02,37.52]);
    const drop=markers.at(-1);const timer=[...timers.values()][0];assert.equal(timer.delay,520);
    map.emit('click',{lngLat:{lng:128,lat:36}});assert.equal(markers.at(-1),drop,'rapid second tap ignored');
    timer.callback();assert.equal(dialog.open,true);
    dialog.querySelector('input').value='운동 후 카페';
    await dialog.querySelector('form').onsubmit({preventDefault(){}});
    const saved=JSON.parse(storage.get('groov-map-saved-places-v1'));
    assert.deepEqual(saved[0].coordinate,[127.02,37.52]);assert.equal(saved[0].name,'운동 후 카페');
    assert.equal(drop.removed,true);assert.equal(container.dataset.savedPlacePicking,'false');
    dialog.close();toggle.onclick();await flush();map.emit('click',{lngLat:{lng:127.1,lat:37.6}});
    const canceled=markers.at(-1);toggle.onclick();assert.equal(canceled.removed,true);
    assert.equal(container.dataset.savedPlacePicking,'false');assert.equal(dialog.open,false);
    assert.equal(JSON.parse(storage.get('groov-map-saved-places-v1')).length,1,'cancel does not save');
    mounted.destroy();assert.equal(map.listenerCount('click'),0);
  }finally{Object.assign(globalThis,previous);}
});

test('pin animation stays on the SVG and selection suppresses competing map actions',async()=>{
  const read=file=>readFile(new URL(file,import.meta.url),'utf8');
  const css=await read('saved-places.css');
  assert.match(css,/\.saved-place-draft-pin svg \{[^}]*animation:saved-pin-drop 520ms/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  for(const file of ['app.js','national-dongs.mjs','course-planner.mjs'])assert.match(await read(file),/dataset.savedPlacePicking === 'true'/,file);
});
