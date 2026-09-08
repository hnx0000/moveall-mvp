import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createDetailStyle } from './detail-style.mjs';
import { routeLengthMeters, sampleRoute } from './route-model.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const districts = readJson('./assets/dobong-dongs.geojson');
const route = readJson('./assets/ssangmun-running-route.geojson');
const baseStyle = readJson('./assets/base-style.json');
// Resolve through the installed app dependency, without embedding a pnpm version.
const appRequire = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const mapRequire = createRequire(appRequire.resolve('maplibre-gl/package.json'));
const { validateStyleMin, createExpression } = mapRequire('@maplibre/maplibre-gl-style-spec');
const ssangmun = districts.features.find((feature) => feature.properties.adm_cd2 === '1132066000');

function polygons(geometry) {
  assert.ok(['Polygon', 'MultiPolygon'].includes(geometry.type));
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function inRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index], b = ring[previous];
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) < 1e-13 && point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0]) && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1])) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function contains(point, geometry) {
  return polygons(geometry).some(([outer, ...holes]) => inRing(point, outer) && !holes.some((hole) => inRing(point, hole)));
}

function evaluate(expression, zoom, properties = {}, geometryType = 1) {
  if (!Array.isArray(expression)) return expression;
  const compiled = createExpression(expression);
  assert.equal(compiled.result, 'success', JSON.stringify(compiled.value));
  return compiled.value.evaluate({ zoom }, { type: geometryType, properties });
}

test('Dobong contains all 14 distinct administrative dongs with valid closed WGS84 polygon rings', () => {
  assert.equal(districts.type, 'FeatureCollection');
  assert.equal(districts.features.length, 14);
  const expectedNames = [
    '쌍문1동', '쌍문2동', '쌍문3동', '쌍문4동',
    '방학1동', '방학2동', '방학3동',
    '창1동', '창2동', '창3동', '창4동', '창5동',
    '도봉1동', '도봉2동',
  ];
  assert.deepEqual(new Set(districts.features.map((feature) => feature.properties.adm_nm.split(' ').at(-1))), new Set(expectedNames));
  const codes = districts.features.map((feature) => feature.properties.adm_cd2);
  assert.equal(new Set(codes).size, 14);
  assert.ok(codes.every((code) => /^11320\d{5}$/.test(code)));
  for (const feature of districts.features) {
    for (const polygon of polygons(feature.geometry)) {
      assert.ok(polygon.length >= 1);
      for (const ring of polygon) {
        assert.ok(ring.length >= 4, feature.properties.adm_nm);
        assert.deepEqual(ring[0], ring.at(-1), 'GeoJSON polygon rings must close');
        assert.ok(ring.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude) && longitude > 126.9 && longitude < 127.2 && latitude > 37.5 && latitude < 37.8));
        assert.ok(new Set(ring.map((coordinate) => coordinate.join(','))).size >= 3);
      }
    }
  }
});

test('the running loop starts in Ssangmun 1 and stays inside the real Dobong geography during playback', () => {
  assert.ok(ssangmun);
  assert.equal(ssangmun.properties.adm_nm, '서울특별시 도봉구 쌍문1동');
  assert.ok(contains(route.geometry.coordinates[0], ssangmun.geometry));
  assert.ok(contains(route.geometry.coordinates.at(-1), ssangmun.geometry));
  assert.equal(contains([126.978, 37.5665], ssangmun.geometry), false, 'Central Seoul must not be mistaken for Ssangmun 1');
  // The sourced loop also crosses neighbouring Banghak 3 and Ssangmun 4.
  // Check the full district union instead of falsely asserting one-dong coverage.
  const total = routeLengthMeters(route.geometry.coordinates);
  for (let distance = 0; distance <= total; distance += 10) {
    const { coordinate } = sampleRoute(route.geometry.coordinates, distance);
    assert.ok(districts.features.some((feature) => contains(coordinate, feature.geometry)), `Route sample at ${distance}m is outside Dobong`);
  }
});

test('the detail skin preserves supplied geographic sources and does not mutate the base style', () => {
  const before = structuredClone(baseStyle);
  const style = createDetailStyle(baseStyle);
  assert.deepEqual(baseStyle, before);
  assert.deepEqual(style.sources, baseStyle.sources);
  assert.equal(style.glyphs, baseStyle.glyphs);
  style.sources.openmaptiles.url = 'changed-only-in-the-returned-copy';
  assert.deepEqual(baseStyle, before);
});

test('all detail style expressions validate and use source layers available in the supplied base', () => {
  const style = createDetailStyle(baseStyle);
  assert.deepEqual(validateStyleMin(style).map((error) => error.message), []);
  const available = new Set(baseStyle.layers.map((layer) => `${layer.source}:${layer['source-layer']}`));
  assert.equal(new Set(style.layers.map((layer) => layer.id)).size, style.layers.length);
  for (const layer of style.layers) {
    if (layer['source-layer']) assert.ok(available.has(`${layer.source}:${layer['source-layer']}`), layer.id);
  }
});

test('map labels prefer Korean and grow proportionately from district to running zoom', () => {
  const labels = createDetailStyle(baseStyle).layers.filter((layer) => layer.type === 'symbol');
  assert.ok(labels.length > 0);
  for (const layer of labels) {
    assert.equal(evaluate(layer.layout['text-field'], 17, { 'name:ko': '쌍문1동', 'name:nonlatin': '다른 이름', name: 'Ssangmun' }), '쌍문1동');
    assert.equal(evaluate(layer.layout['text-field'], 17, { 'name:nonlatin': '우이천', name: 'Stream' }), '우이천');
    assert.equal(evaluate(layer.layout['text-field'], 17, { name: 'Park' }), 'Park');
    const sizes = [12, 15, 17, 19].map((zoom) => evaluate(layer.layout['text-size'], zoom));
    assert.ok(sizes.every((size) => Number.isFinite(size) && size >= 8 && size <= 24), layer.id);
    assert.ok(sizes.every((size, index) => index === 0 || size >= sizes[index - 1]), layer.id);
    assert.equal(layer.layout['text-allow-overlap'], false);
  }
});

test('3D buildings retain source heights and all principal street classes remain thin at zoom 17', () => {
  const style = createDetailStyle(baseStyle);
  const buildings = style.layers.filter((layer) => layer.type === 'fill-extrusion');
  assert.ok(buildings.length > 0);
  for (const layer of buildings) {
    assert.equal(layer['source-layer'], 'building');
    for (const height of [0, 8, 36, 92]) {
      assert.equal(evaluate(layer.paint['fill-extrusion-height'], 17, { render_height: height, score: 999999 }, 3), height);
    }
    assert.equal(evaluate(layer.paint['fill-extrusion-base'], 17, { render_min_height: 12 }, 3), 12);
  }
  const roadLayers = style.layers.filter((layer) => layer.type === 'line' && layer['source-layer'] === 'transportation');
  for (const roadClass of ['service', 'track', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway', 'path', 'pedestrian']) {
    const visible = roadLayers.filter((layer) => (layer.minzoom ?? 0) <= 17 && (layer.maxzoom ?? 24) > 17 && (!layer.filter || evaluate(layer.filter, 17, { class: roadClass }, 2)));
    assert.ok(visible.length > 0, `${roadClass} must be represented`);
    for (const layer of visible) {
      const width = evaluate(layer.paint['line-width'], 17, { class: roadClass }, 2);
      assert.ok(width > 0 && width <= 3.5, `${roadClass} is too thick at running scale: ${width}px`);
    }
  }
});
