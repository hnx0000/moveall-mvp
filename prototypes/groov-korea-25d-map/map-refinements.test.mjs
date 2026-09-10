import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {createLocateAction} from './map-location.mjs';
import {parseAddress,classifyAddress,rankAddressResults,buildingSearchQuery} from './address-match.mjs';
import {neighborhoodLabel,readVerifiedArea,acceptsNeighborhoodMessage,MAX_VERIFICATION_AGE,verificationCheckDelay,findVerifiedEntry} from './verified-neighborhood.mjs';
import {mountSearchSelection} from './search-selection.mjs';
import {mountNationalDongs} from './national-dongs.mjs';
import {createGeocodingProvider} from './map-services.mjs';
const read=name=>readFile(new URL(name,import.meta.url),'utf8');

test('locate recentres on every completed click without starting or stopping GPS recording',()=>{
  const calls=[],positions=[],busy=[];
  const action=createLocateAction({geolocation:{getCurrentPosition(...args){calls.push(args);}},onPosition:p=>positions.push(p),onBusy:x=>busy.push(x)});
  action.locate();action.locate();assert.equal(calls.length,1);
  assert.equal(calls[0][2].maximumAge,0);
  calls[0][0]({timestamp:Date.now(),coords:{longitude:127,latitude:37,accuracy:12}});
  action.locate();calls[1][0]({timestamp:Date.now(),coords:{longitude:127.01,latitude:37.01,accuracy:15}});
  assert.deepEqual(positions,[[127,37],[127.01,37.01]]);
  assert.deepEqual(busy,[true,false,true,false]);action.destroy();
});
test('GPS denied, missing, invalid and late responses recover without moving the map',()=>{
  const callbacks=[],moved=[],messages=[];
  const action=createLocateAction({geolocation:{getCurrentPosition(...args){callbacks.push(args);}},onPosition:p=>moved.push(p),notify:m=>messages.push(m)});
  action.locate();callbacks[0][1]({code:1});callbacks[0][0]({coords:{longitude:127,latitude:37}});
  assert.equal(moved.length,0);assert.match(messages.at(-1),/권한/);
  action.locate();callbacks[1][0]({coords:{longitude:NaN,latitude:37}});assert.equal(moved.length,0);
  action.locate();action.destroy();callbacks[2][0]({coords:{longitude:127,latitude:37}});assert.equal(moved.length,0);
  const missing=createLocateAction({onPosition:()=>assert.fail(),notify:m=>messages.push(m)});
  missing.locate();assert.match(messages.at(-1),/사용할 수 없습니다/);
});
test('GPS timeout releases pending state and ignores its late success',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let callback,count=0;const messages=[];
  const action=createLocateAction({geolocation:{getCurrentPosition(success){callback=success;count++;}},onPosition:()=>assert.fail(),notify:m=>messages.push(m)});
  action.locate();t.mock.timers.tick(16001);assert.match(messages.at(-1),/지연/);
  callback({coords:{longitude:127,latitude:37}});action.locate();assert.equal(count,2);action.destroy();
});
test('Korean road, lot, no-space and interior-unit inputs retain exact building numbers',()=>{
  assert.deepEqual(parseAddress('도봉구 노해로147'),{kind:'road',street:'노해로',number:'147'});
  assert.deepEqual(parseAddress('쌍문동378-45'),{kind:'lot',street:'쌍문동',number:'378-45'});
  assert.equal(parseAddress('중구 세종대로 110 2층 201호').number,'110');
  assert.equal(buildingSearchQuery('중구 세종대로110 2층 201호'),'중구 세종대로 110');
  assert.equal(buildingSearchQuery('도봉구 노해로147'),'도봉구 노해로 147');
  assert.equal(classifyAddress('도봉구 노해로147',{address:'도봉구 노해로63길 147'}),'nearby');
  assert.equal(classifyAddress('쌍문동378-45',{address:'쌍문동 45-13'}),'nearby');
  assert.equal(classifyAddress('중구 세종대로99999',{address:'중구 세종대로110'}),'nearby');
  assert.equal(classifyAddress('도봉구 노해로147',{address:'다른구 노해로147'}),'nearby');
  assert.equal(classifyAddress('중구 세종대로110 2층',{address:'서울특별시 중구 세종대로 110'}),'exact');
});
test('geocoder distinguishes absent exact addresses from nearby suggestions',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({features:[{properties:{countrycode:'KR',name:'서울시청',district:'중구',street:'세종대로',housenumber:'110'},geometry:{coordinates:[126.978,37.566]}}]})});
  try{
    const result=await createGeocodingProvider().search({text:'중구 세종대로99999'});
    assert.equal(result.missingExact,true);assert.equal(result.places[0].match,'nearby');assert.match(result.message,/입력한 번지와 정확히 일치/);
  }finally{globalThis.fetch=previous;}
});
test('exact addresses lead, duplicate results collapse and lot and road alternatives are both checked',()=>{
  const nearby={name:'주변',address:'도봉구 노해로 145',coordinate:[127,37]};
  const exact={name:'일치',address:'도봉구 노해로 147',lotAddress:'도봉구 쌍문동378-45',coordinate:[127.001,37]};
  const result=rankAddressResults('노해로147',[nearby,exact,exact]);
  assert.equal(result.length,2);assert.equal(result[0].match,'exact');
  assert.equal(classifyAddress('쌍문동378-45',exact),'exact');
});
test('verified area display removes administrative dong numbering, not street names',()=>{
  assert.equal(neighborhoodLabel({district:'도봉구',neighborhood:'쌍문1동'}),'도봉구 쌍문동');
  assert.equal(neighborhoodLabel({district:'강남구',neighborhood:'역삼제2동'}),'강남구 역삼동');
  assert.equal(neighborhoodLabel({district:'종로구',neighborhood:'종로1가'}),'종로구 종로1가');
});
test('verified connection rejects expired or guessed data and wrong window/origin/nonce',()=>{
  assert.equal(verificationCheckDelay(MAX_VERIFICATION_AGE),3600000);
  const now=Date.now(),area={neighborhood:'쌍문1동',district:'도봉구',latitude:37.65,longitude:127.02,verifiedAt:new Date(now-1000).toISOString()};
  assert.ok(readVerifiedArea(area,now));assert.equal(readVerifiedArea({...area,district:undefined},now),null);
  assert.equal(readVerifiedArea({...area,verifiedAt:new Date(now-MAX_VERIFICATION_AGE-1).toISOString()},now),null);
  assert.equal(readVerifiedArea({...area,verifiedAt:new Date(now+1000).toISOString()},now),null);
  const source={},nonce='one-time',event={source,origin:'http://localhost:8081',data:{type:'groov:verified-neighborhood',nonce,area}};
  assert.equal(acceptsNeighborhoodMessage(event,{source,nonce}),true);
  for(const changed of [{origin:'https://evil.example'},{source:{}},{data:{...event.data,nonce:'other'}}])assert.equal(acceptsNeighborhoodMessage({...event,...changed},{source,nonce}),false);
});
test('identical dong/district names in different provinces never select the first match blindly',async()=>{
  const index=JSON.parse(await read('assets/administrative/search-index.json'));
  const area={neighborhood:'중앙동',district:'중구',province:'울산광역시',regionCode:'중구:중앙동',latitude:35.55,longitude:129.32};
  assert.equal(findVerifiedEntry(index.dong,area).name,'울산광역시 중구 중앙동');
  assert.equal(findVerifiedEntry(index.dong,{...area,province:'부산광역시'}).name,'부산광역시 중구 중앙동');
  assert.equal(findVerifiedEntry(index.dong,{...area,province:'',latitude:37,longitude:127}),null);
});
function mockElements(){
  const elements=[],markers=[];
  class Element {children=[];attributes={};append(...x){this.children.push(...x);}setAttribute(k,v){this.attributes[k]=v;}}
  class Marker {constructor({element}){this.element=element;markers.push(this);}setLngLat(p){this.coordinate=p;return this;}addTo(){return this;}remove(){this.removed=true;}}
  return {elements,markers,document:{body:{dataset:{}},createElement(){const el=new Element();elements.push(el);return el;}},maplibregl:{Marker}};
}
test('a new search replaces its marker and keeps an untrusted label as text only',()=>{
  const prev={document:globalThis.document,maplibregl:globalThis.maplibregl},mock=mockElements();
  Object.assign(globalThis,{document:mock.document,maplibregl:mock.maplibregl});
  try{
    const ui=mountSearchSelection({});ui.show({name:'<img onerror=bad>',coordinate:[127,37]});
    assert.equal(mock.markers[0].element.children[0].textContent,'<img onerror=bad>');
    ui.show({address:'도봉구 노해로147',coordinate:[127.02,37.65]});
    assert.equal(mock.markers[0].removed,true);assert.deepEqual(mock.markers[1].coordinate,[127.02,37.65]);ui.clear();assert.equal(mock.markers[1].removed,true);
  }finally{Object.assign(globalThis,prev);}
});
test('administrative selection persists actual boundaries and search pin, using viewport padding',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const prev={document:globalThis.document,maplibregl:globalThis.maplibregl,fetch:globalThis.fetch},mock=mockElements();
  Object.assign(globalThis,{document:mock.document,maplibregl:mock.maplibregl,fetch:async path=>({ok:true,json:async()=>JSON.parse(await read(path))})});
  class Map extends EventEmitter {sources={};on(type,layer,handler){return super.on(type,handler||layer);}addSource(id,source){this.sources[id]={data:source.data,setData(data){this.data=data;}};}getSource(id){return this.sources[id];}addLayer(){}getZoom(){return 6;}getPitch(){return 0;}getBearing(){return 0;}fitBounds(bounds,options){this.fit={bounds,options};}}
  try{
    const map=new Map(),padding={top:80,bottom:100,left:16,right:66};
    const api=await mountNationalDongs(map,{context:false,padding:()=>padding});
    await api.select(api.index.sgg.find(e=>e.code==='11320'));
    assert.equal(map.sources['searched-region'].data.features.length,14);assert.deepEqual(map.fit.options.padding,padding);assert.equal(mock.markers.length,1);
    const dong=api.index.dong.find(e=>e.code==='1132066000');await api.select(dong);
    const feature=map.sources['searched-region'].data.features[0];
    assert.equal(feature.properties.adm_cd2,dong.code);assert.equal(mock.markers[0].removed,true);
  }finally{Object.assign(globalThis,prev);}
});
test('pin move and design archive entry are removed; return action shares the same controls',async()=>{
  const [course,index,app,detail,profile]=await Promise.all(['course-planner.mjs','index.html','app.js','detail.html','../../apps/mobile/app/(tabs)/profile.tsx'].map(read));
  assert.doesNotMatch(course,/pin-move|movingPin/);assert.match(course,/draggable: true/);
  assert.match(course,/<div class="course-small-actions"><button id="course-no-return"/);
  assert.doesNotMatch(index,/dna-open|dna-dialog/);assert.doesNotMatch(app,/renderAssetArchive|toggleGps/);
  assert.doesNotMatch(detail,/detail-fit|data-view="ssangmun"/);
  assert.match(detail,/id="detail-locate"/);assert.match(index,/id="gps-locate"/);assert.doesNotMatch(profile,/source=my-settings.*reward-collection|reward-collection\?tab/);
});
test('phone map tools stay upper right and toasts reset top instead of stretching',async()=>{
  const [css,app,detail]=await Promise.all(['mobile-map.css','app.js','detail.js'].map(read));
  for(const source of [app,detail]){assert.doesNotMatch(source,/key:'tools'/);assert.match(source,/mountLocateButton/);}
  assert.match(css,/\.map-controls,\.map-actions \{display:flex!important;position:absolute;top:calc\(76px/);
  assert.match(css,/\.toast,\.detail-toast \{top:auto!important;bottom:calc/);
  assert.match(css,/min-width:44px;width:44px;min-height:44px!important/);
  assert.doesNotMatch(css,/#detail-locate,\.map-controls>#gps-locate \{order:-3/);
  assert.match(css,/\[data-mobile-open=true\]:not\(\[hidden\]\) \{right:66px/);
});
