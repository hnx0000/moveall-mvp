import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {validatePins,validateCourse,outboundPins,withReturnRoute,parseRoutingResult,routingUrl,routePathEvidence} from './course-model.mjs';
import {createMapServices} from './map-services.mjs';
import {contourGrid} from './terrain-layers.mjs';
import {EnvironmentLayers,createExplorationStore} from './environment-layers.mjs';
import {mountBoundaryPulse} from './map-motion.mjs';
const start=[127.027,37.647];
const pins=Array.from({length:30},(_,i)=>[start[0]+i*.001,start[1]]);
const parsed=(p,sport='running')=>parseRoutingResult({features:[{geometry:{type:'LineString',coordinates:p}}]},p,sport);

test('30 editable pins accepted; 31 rejected, invalid and adjacent duplicate coordinates rejected',()=>{
  assert.equal(validatePins(pins).length,30);assert.throws(()=>validatePins([...pins,[127.1,37.647]]),/30/);
  assert.throws(()=>validatePins([start,start]));assert.throws(()=>validatePins([start,[NaN,37.6]]));
});
test('sixth waypoint turnaround trims later pins and mirrors all routed vertices including bends',()=>{
  const before=structuredClone(pins),outbound=outboundPins(pins,6);
  assert.equal(outbound.length,7);assert.deepEqual(pins,before);
  const road=outbound.flatMap((p,i)=>i?[[p[0]-.0004,p[1]+.0003],p]:[p]);
  const routed=parseRoutingResult({features:[{geometry:{type:'LineString',coordinates:road}}]},outbound,'running');
  const returned=withReturnRoute(routed,6);
  assert.deepEqual(returned.coordinates, [...returned.coordinates].reverse());
  assert.equal(returned.coordinates.length,road.length*2-1);
  assert.ok(Math.abs(returned.distanceMeters-routed.distanceMeters*2)<=1);
  assert.equal(validateCourse({...returned,name:'6번 반환점',pins:outbound}).turnaroundIndex,6);
  assert.throws(()=>outboundPins(pins,0));assert.throws(()=>outboundPins(pins,30));
  assert.throws(()=>validateCourse({...returned,name:'wrong',pins:outbound,coordinates:road}));
});
test('route must reach intermediate pins; saved distance is computed from geometry',()=>{
  assert.throws(()=>parseRoutingResult({features:[{geometry:{type:'LineString',coordinates:[start,pins[2]]}}]},[start,[127.029,37.66],pins[2]],'running'),/경유/);
  const r=validateCourse({...parsed(pins.slice(0,3)),name:'코스',distanceMeters:999999});
  assert.ok(r.distanceMeters<500);
});
test('river and quiet preference affect actual provider URL, hiking is a supported foot profile',()=>{
  const u=routingUrl(pins.slice(0,2),'running',{river:true,quiet:true});
  assert.equal(u.searchParams.get('profile:consider_river'),'1');assert.equal(u.searchParams.get('profile:consider_noise'),'1');
  assert.notEqual(u.href,routingUrl(pins.slice(0,2),'running').href);
  assert.equal(routingUrl(pins.slice(0,2),'hiking').searchParams.get('profile:consider_forest'),'1');
  assert.equal(routingUrl(pins.slice(0,2),'cycling',{quiet:true}).searchParams.get('profile:consider_traffic'),'1');
});
test('road evidence uses incremental distances and tolerates missing metadata',()=>{
  assert.deepEqual(routePathEvidence([['WayTags','Distance'],['highway=cycleway estimated_river_class=5','600'],['highway=residential estimated_river_class=0','400']]),{riverShare:.6,pathShare:.6,classifiedMeters:1000});
  assert.equal(routePathEvidence(undefined),null);
});
test('symmetric return has equal climbing/descent and retains measured elevation',()=>{
  const out=parsed([[127,37.6,40],[127.001,37.6,50],[127.002,37.6,43]]);
  const r=withReturnRoute(out,2);assert.equal(r.elevation.ascentMeters,r.elevation.descentMeters);
  assert.equal(r.coordinates[0][2],40);assert.equal(r.coordinates.at(-1)[2],40);
  assert.equal(parsed(pins.slice(0,2)).elevation,null);
});
test('automatic generation survives corridor service failure using graph routes, never a rendered beeline fallback',async()=>{
  let calls=0;
  const routing={async route({pins,sport}){calls++;return {...parsed(pins,sport),pathEvidence:{riverShare:.9,pathShare:.95}};}};
  const svc=createMapServices({routing,geocoding:{},corridors:{async find(){throw new Error('unavailable');}}});
  const r=await svc.suggest({start,sport:'running',distanceKm:7,preference:'river'});
  assert.ok(calls>=2);assert.equal(r.discoveryFallback,true);assert.ok(Math.abs(r.distanceMeters-7000)<50);
  assert.deepEqual(r.coordinates,[...r.coordinates].reverse());
  const missing=createMapServices({routing:{async route({pins}){return parsed(pins);}},geocoding:{},corridors:{async find(){throw Error('down');}}});
  await assert.rejects(()=>missing.suggest({start,distanceKm:7,preference:'river'}));
});
test('cycling refuses a different legal reverse route instead of fabricating a reversible track',async()=>{
  let count=0;
  const svc=createMapServices({routing:{async route({pins}){const r=parsed(pins,'cycling');if(count++)r.distanceMeters+=500;return r;}},geocoding:{},corridors:{}});
  await assert.rejects(()=>svc.route({pins:pins.slice(0,3),sport:'cycling',turnaroundIndex:2}),/역방향/);
  count=0;
  const parallel=createMapServices({routing:{async route({pins}){const r=parsed(pins,'cycling');if(count++)r.coordinates=r.coordinates.map(p=>[p[0],p[1]+.0001]);return r;}},geocoding:{},corridors:{}});
  await assert.rejects(()=>parallel.route({pins:pins.slice(0,3),sport:'cycling',turnaroundIndex:2}),/역방향/);
});
test('contours follow DEM elevations and leave missing data cells empty',()=>{
  const g=[[[127,37,0],[127.01,37,40]],[[127,37.01,0],[127.01,37.01,40]]];
  const result=contourGrid(g,20);
  const contour=result.features.find(f=>f.properties.elevation===20);
  assert.ok(contour.geometry.coordinates.every(p=>Math.abs(p[0]-127.005)<1e-8));
  g[0][0][2]=null;assert.equal(contourGrid(g).features.length,0);
  const joined=contourGrid([[[127,37,0],[127.01,37,40]],[[127,37.01,0],[127.01,37.01,40]],[[127,37.02,0],[127.01,37.02,40]]],20);
  assert.equal(joined.features.find(f=>f.properties.elevation===20).geometry.coordinates.length,3);
});
test('selected multipolygon and holes are unchanged; lift survives reduced motion and score-height independence',()=>{
  const old=globalThis.matchMedia,oldCancel=globalThis.cancelAnimationFrame;
  globalThis.matchMedia=()=>({matches:true});globalThis.cancelAnimationFrame=()=>{};
  class Map extends EventEmitter{sources={};layers=[];paint={};addSource(id,s){this.sources[id]={...s,setData(data){this.data=data;}};}getSource(id){return this.sources[id];}addLayer(l){this.layers.push(l);}setPaintProperty(id,k,v){this.paint[id+':'+k]=v;}getCenter(){return{lat:37};}getZoom(){return 10;}}
  try{
    const map=new Map(),select=mountBoundaryPulse(map,'test');
    const shape={type:'Feature',geometry:{type:'MultiPolygon',coordinates:[[[[127,37],[128,37],[128,38],[127,37]],[[127.2,37.2],[127.3,37.2],[127.3,37.3],[127.2,37.2]]]]},properties:{}};
    const before=structuredClone(shape);select(shape);assert.deepEqual(map.getSource('test').data,before);
    assert.ok(map.paint['test-lift:fill-extrusion-height']>0);
    assert.ok(map.layers.filter(l=>l.type==='line').every(l=>l.layout['line-join']==='round'));
    select(null);assert.deepEqual(map.getSource('test').data.features,[]);
  }finally{globalThis.matchMedia=old;globalThis.cancelAnimationFrame=oldCancel;}
});
test('weather providers reject stale data and unconfigured sources; exploration rejects draft routes',async()=>{
  const layers=new EnvironmentLayers();assert.equal((await layers.load('radar')).reason,'unconfigured');
  layers.register('radar',{async load(){return{observedAt:1,validUntil:2,frames:[]};}});
  assert.equal((await layers.load('radar',{time:3})).reason,'stale');
  layers.register('radar',{async load(){return{observedAt:1,validUntil:10,frames:[]};}});
  assert.equal((await layers.load('radar',{time:3})).available,true);
  await assert.rejects(()=>createExplorationStore({}).ingest({id:'draft',segments:[],verified:false}));
});
