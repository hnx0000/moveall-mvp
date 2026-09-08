import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { once, EventEmitter } from 'node:events';
import { routingUrl, validatePins, parseRoutingResult, validateCourse } from './course-model.mjs';
import { createCourseApi } from './course-api.mjs';
import { mountOrientation, DONG_FADE, SCORE_HEIGHT } from './map-motion.mjs';
import { createRequire } from 'node:module';
const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const pins=[[127.0216981,37.6527011],[127.0241013,37.6541519],[127.0244273,37.6501454]];
test('dong boundaries fade in around zoom 14–15 and score heights stay small and vanish at street zoom',()=>{
  const appRequire=createRequire(new URL('../../apps/mobile/package.json',import.meta.url));
  const mapRequire=createRequire(appRequire.resolve('maplibre-gl/package.json'));
  const {createExpression}=mapRequire('@maplibre/maplibre-gl-style-spec');
  const evaluate=(value,zoom,score=1000000)=>{const expression=createExpression(value);assert.equal(expression.result,'success');return expression.value.evaluate({zoom},{type:3,properties:{score}});};
  assert.equal(evaluate(DONG_FADE,13.8),0);assert.ok(evaluate(DONG_FADE,14.5)>0&&evaluate(DONG_FADE,14.5)<evaluate(DONG_FADE,15));
  assert.ok(evaluate(SCORE_HEIGHT,5)<=320);assert.ok(evaluate(SCORE_HEIGHT,10)<=45);assert.equal(evaluate(SCORE_HEIGHT,14),0);
});

test('route profiles use walking/cycling routing and explicitly disable beelines and ferries',()=>{
  for(const sport of ['running','cycling']){const url=routingUrl(pins,sport);assert.equal(url.hostname,'brouter.de');assert.equal(url.searchParams.get('profile:add_beeline'),'0');assert.equal(url.searchParams.get('profile:allow_ferries'),'0');assert.equal(url.searchParams.get('profile'),sport==='running'?'hiking-mountain':'trekking');}
  assert.throws(()=>validatePins([pins[0],pins[0]]));assert.throws(()=>validatePins([[0,0],pins[0]]));assert.throws(()=>routingUrl(pins,'car'));
});
test('invalid and unavailable routes cannot masquerade as valid courses',()=>{
  assert.throws(()=>parseRoutingResult({features:[]},pins,'running'));
  assert.throws(()=>parseRoutingResult({features:[{geometry:{type:'LineString',coordinates:[[128,35],[128.01,35.01]]}}]},pins,'running'));
  const course=validateCourse({name:' QA ',sport:'running',pins,coordinates:pins,distanceMeters:99999999});
  assert.equal(course.name,'QA');assert.ok(course.distanceMeters>300&&course.distanceMeters<1500);
  assert.throws(()=>validateCourse({...course,name:' '.repeat(5)}));
});
test('nationwide shards match manifest hashes, bounds and all unique search codes',async()=>{
  const manifest=await readJson('assets/administrative/manifest.json'),index=await readJson('assets/administrative/search-index.json');
  const codes=new Set();let count=0;const {createHash}=await import('node:crypto');
  for(const part of manifest.sido){const raw=await readFile(new URL('assets/administrative/'+part.file,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),part.sha256);const data=JSON.parse(raw);assert.equal(data.features.length,part.count);for(const f of data.features){assert.ok(!codes.has(f.properties.adm_cd2));codes.add(f.properties.adm_cd2);}count+=data.features.length;}
  assert.equal(count,3558);assert.equal(index.dong.length,count);assert.ok(index.dong.every(d=>codes.has(d.code)));assert.ok(index.sgg.some(d=>(d.fullName||d.name).includes('해운대')));assert.ok(index.sido.some(d=>d.name.includes('제주')));
  for(const context of [manifest.context.sidoCoarse,manifest.context.sggCoarse]){const raw=await readFile(new URL('assets/administrative/'+context.file,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),context.sha256);assert.equal(JSON.parse(raw).features.length,context.count);}
});
test('flat/tilted state and bearing are retained through camera moves; compass only resets north',()=>{
  const oldDocument=globalThis.document;globalThis.document={body:{dataset:{}}};
  class Button extends EventTarget {style={setProperty(){}};attributes={};setAttribute(k,v){this.attributes[k]=v;}}
  class Map extends EventEmitter {pitch=48;bearing=-25;getPitch(){return this.pitch;}getBearing(){return this.bearing;}stop(){}easeTo(options){this.pitch=options.pitch??this.pitch;this.bearing=options.bearing??this.bearing;this.emit('pitch');this.emit('rotate');this.emit('moveend');}}
  try{const map=new Map(),tilt=new Button(),compass=new Button();const ui=mountOrientation(map,tilt,compass);assert.equal(tilt.textContent,'평면');tilt.dispatchEvent(new Event('click'));assert.equal(map.pitch,0);assert.equal(map.bearing,-25);map.easeTo({...ui.camera(),center:[129,35]});assert.equal(map.pitch,0);assert.equal(tilt.textContent,'2.5D');compass.dispatchEvent(new Event('click'));assert.equal(map.bearing,0);assert.equal(map.pitch,0);tilt.dispatchEvent(new Event('click'));assert.equal(map.pitch,48);assert.equal(map.bearing,0);}finally{globalThis.document=oldDocument;}
});
test('saved courses survive API re-instantiation; atomic concurrent saves and deletion stay scoped',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'groov-course-test-'));
  let handler=createCourseApi(pathToFileURL(directory+sep));
  const server=createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost')).then(handled=>{if(!handled){res.writeHead(404);res.end();}}));
  server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;
  try{
    const post=()=>fetch(url+'/api/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'TEST COURSE',sport:'running',pins,coordinates:pins})});
    const responses=await Promise.all([post(),post()]);assert.ok(responses.every(r=>r.status===201));
    handler=createCourseApi(pathToFileURL(directory+sep));let saved=await(await fetch(url+'/api/courses')).json();assert.equal(saved.courses.length,2);
    const denied=await fetch(url+'/api/courses',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
    await fetch(url+'/api/courses/'+saved.courses[0].id,{method:'DELETE'});saved=await(await fetch(url+'/api/courses')).json();assert.equal(saved.courses.length,1);
  }finally{server.close();await once(server,'close');const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('groov-course-test-'));await rm(target,{recursive:true});}
});
