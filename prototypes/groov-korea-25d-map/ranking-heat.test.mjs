import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { mountRankingHeat, RANKING_HEAT_COLOR, RANKING_HEAT_OPACITY } from './ranking-heat.mjs';
const appRequire = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const mapRequire = createRequire(appRequire.resolve('maplibre-gl/package.json'));
const { createExpression, validateStyleMin } = mapRequire('@maplibre/maplibre-gl-style-spec');

test('ranking paint is valid MapLibre styling and grows stronger with heat at every map zoom', () => {
  const style = { version:8, sources:{areas:{type:'geojson',data:{type:'FeatureCollection',features:[]}}},layers:[
    {id:'heat',type:'fill',source:'areas',paint:{'fill-color':RANKING_HEAT_COLOR,'fill-opacity':RANKING_HEAT_OPACITY}},
  ] };
  assert.deepEqual(validateStyleMin(style).map(e=>e.message),[]);
  const compiled=createExpression(RANKING_HEAT_OPACITY);assert.equal(compiled.result,'success');
  const evaluate=(heat,zoom=6)=>compiled.value.evaluate({zoom},{type:3,properties:{heat}});
  for(const zoom of [4.5,6.8,10,13.3,15,18]) {
    const values=[0,20,40,62,82,100].map(h=>evaluate(h,zoom));
    assert.ok(values.every((value,i)=>i===0||value>values[i-1]));
    assert.ok(values[0]>.05&&values.at(-1)<.7,'roads remain visible beneath the heat tint');
  }
  assert.equal(evaluate(-20),evaluate(0));assert.equal(evaluate(150),evaluate(100));
  assert.equal(evaluate(undefined),evaluate(0));assert.equal(evaluate('unknown'),evaluate(0));
  assert.equal(RANKING_HEAT_COLOR.at(-1),'#ff5733');
  assert.doesNotMatch(JSON.stringify([RANKING_HEAT_COLOR,RANKING_HEAT_OPACITY]),/"score"|"rank"|"zoom"/);
});

function mockMap() {
  const paints=new Map(),changes=[];
  return {paints,changes,getLayer:id=>paints.has(id),getPaintProperty:(id,key)=>paints.get(id)[key],
    setPaintProperty(id,key,value){changes.push([id,key,value]);paints.get(id)[key]=value;}};
}

test('ranking opens heat paint and closes back to exact base paint without changing boundaries or height', () => {
  const map=mockMap();
  for(const id of ['groov-region-wash','detail-area-tint']) map.paints.set(id,{
    'fill-color':'#171c1e','fill-opacity':['interpolate',['linear'],['zoom'],6,.2,15,.03],
  });
  const baseline=structuredClone(map.paints);
  const heat=mountRankingHeat(map,[...map.paints.keys()]);
  heat.setEnabled(false);assert.equal(map.changes.length,0);
  heat.setEnabled(true);assert.equal(heat.enabled,true);
  for(const paint of map.paints.values()) {
    assert.deepEqual(paint['fill-color'],RANKING_HEAT_COLOR);
    assert.deepEqual(paint['fill-opacity'],RANKING_HEAT_OPACITY);
  }
  heat.setEnabled(true);heat.setEnabled(false);assert.equal(heat.enabled,false);
  assert.deepEqual(map.paints,baseline,'repeated open never overwrites the original style');
  heat.setEnabled(true);heat.setEnabled(false);assert.deepEqual(map.paints,baseline);
  assert.ok(map.changes.every(([,key])=>['fill-color','fill-opacity'].includes(key)));
});

test('opening before map load is safe and a later opening picks up the latest base settings', () => {
  const map=mockMap(),heat=mountRankingHeat(map,['areas']);
  heat.setEnabled(true);assert.equal(map.changes.length,0);
  map.paints.set('areas',{'fill-color':'#111111','fill-opacity':.04});
  heat.setEnabled(true);heat.setEnabled(false);assert.equal(map.paints.get('areas')['fill-opacity'],.04);
  map.paints.get('areas')['fill-opacity']=.015;
  heat.setEnabled(true);heat.setEnabled(false);assert.equal(map.paints.get('areas')['fill-opacity'],.015);
});

test('national heat follows independent mode; detail ranking retains its existing heat wiring',async()=>{
  const [app,detail]=await Promise.all(['app.js','detail.js'].map(f=>readFile(new URL(f,import.meta.url),'utf8')));
  assert.match(app,/mountRankingHeat\(map, \['groov-region-wash'\]\)/);
  assert.match(app,/onRankingModeChange:enabled=>rankingHeat\?\.setEnabled\(enabled\)/);
  assert.match(app,/rankingHeat.setEnabled\(nationalHUD.rankingMode\)/);
  assert.match(app,/nationalHUD.closeRegionMenu\(\)/);
  assert.doesNotMatch(app,/nationalHUD.close\(\)/);
  assert.match(detail,/mountRankingHeat\(map, \['detail-area-tint'\]\)/);
  assert.match(detail,/show\('detail-ranking',key==='ranking'\);\s*rankingHeat\?\.setEnabled\(key==='ranking'\)/);
  assert.match(detail,/show\("detail-ranking", open\);\s*rankingHeat\?\.setEnabled\(open\)/);
  assert.match(detail,/show\("detail-ranking", false\);\s*rankingHeat\?\.setEnabled\(false\)/);
});
