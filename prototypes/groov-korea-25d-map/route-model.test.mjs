import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { distanceMeters, routeLengthMeters, sampleRoute, filterGpsFix } from './route-model.mjs';

test('distance uses WGS84 coordinates and playback preserves a turning vertex', () => {
  const route = [[127.02, 37.65], [127.0205, 37.65], [127.0205, 37.6505]];
  const firstLeg = distanceMeters(route[0], route[1]);
  assert.ok(firstLeg > 43 && firstLeg < 45);
  assert.ok(routeLengthMeters(route) > 98 && routeLengthMeters(route) < 101);
  const sample = sampleRoute(route, firstLeg + 10);
  assert.deepEqual(sample.completedCoordinates[1], route[1]);
  assert.equal(sample.coordinate[0], route[1][0]);
  assert.ok(sample.coordinate[1] > route[1][1] && sample.coordinate[1] < route[2][1]);
  assert.equal(Math.round(sample.bearing), 0);
});

test('playback clamps bounds and handles empty or repeated coordinates', () => {
  assert.equal(sampleRoute([], 10).coordinate, null);
  assert.deepEqual(sampleRoute([[127, 37], [127, 37]], 10).coordinate, [127, 37]);
  const route = [[127, 37], [127.001, 37]];
  assert.deepEqual(sampleRoute(route, -1).coordinate, route[0]);
  assert.deepEqual(sampleRoute(route, 100000).coordinate, route[1]);
  assert.equal(sampleRoute(route, 100000).progress, 1);
});

const initial = { longitude: 127.02, latitude: 37.65, accuracy: 8, timestamp: 100000 };
test('GPS rejects low accuracy, teleportation, stale and out-of-order fixes', () => {
  assert.equal(filterGpsFix(null, initial).accepted, true);
  assert.equal(filterGpsFix(initial, { ...initial, accuracy: 100, timestamp: 101000 }).reason, 'accuracy');
  assert.equal(filterGpsFix(initial, { ...initial, longitude: 127.03, timestamp: 101000 }).reason, 'speed');
  assert.equal(filterGpsFix(initial, { ...initial, timestamp: 99000 }).reason, 'out-of-order');
  assert.equal(filterGpsFix(null, initial, { now: 130000 }).reason, 'stale');
  assert.equal(filterGpsFix(null, { ...initial, latitude: NaN }).reason, 'invalid');
});

test('GPS accepts plausible running and excludes stationary jitter from distance', () => {
  const running = filterGpsFix(initial, { ...initial, latitude: 37.65003, timestamp: 101000 });
  assert.equal(running.accepted, true);
  assert.ok(running.distanceMeters > 3 && running.distanceMeters < 4);
  assert.equal(filterGpsFix(initial, { ...initial, latitude: 37.650003, timestamp: 101000 }).reason, 'stationary');
});

test('GPS recovery starts a new segment without fabricating lost distance', () => {
  const recovered = filterGpsFix(initial, { ...initial, latitude: 37.651, timestamp: 160000 });
  assert.equal(recovered.accepted, true);
  assert.equal(recovered.breakSegment, true);
  assert.equal(recovered.distanceMeters, 0);
  assert.equal(recovered.reason, 'signal-recovered');
});

test('the demo is a 2 km closed loop and every segment follows an original OSM way edge', () => {
  const route = JSON.parse(fs.readFileSync(new URL('./assets/ssangmun-running-route.geojson', import.meta.url), 'utf8'));
  const source = fs.readFileSync(new URL('./assets/ssangmun-osm-source.osm', import.meta.url), 'utf8');
  const sourceEdges = new Set();
  for (const way of source.matchAll(/<way\b[^>]*>([\s\S]*?)<\/way>/g)) {
    const refs = [...way[1].matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((match) => match[1]);
    for (let index = 1; index < refs.length; index += 1) {
      sourceEdges.add(`${refs[index - 1]}:${refs[index]}`);
      sourceEdges.add(`${refs[index]}:${refs[index - 1]}`);
    }
  }
  const refs = route.properties.sourceNodeIds;
  for (let index = 1; index < refs.length; index += 1) assert.ok(sourceEdges.has(`${refs[index - 1]}:${refs[index]}`));
  assert.equal(route.properties.demo, true);
  assert.equal(route.properties.actualUserRun, false);
  assert.deepEqual(route.geometry.coordinates[0], route.geometry.coordinates.at(-1));
  assert.ok(routeLengthMeters(route.geometry.coordinates) > 1900 && routeLengthMeters(route.geometry.coordinates) < 2200);
  assert.ok(new Set(refs).size / refs.length > 0.95, 'The loop should not consist mainly of a retraced path');
});
