import fs from 'node:fs';
import { distanceMeters, routeLengthMeters } from './route-model.mjs';

const source = fs.readFileSync(new URL('./assets/ssangmun-osm-source.osm', import.meta.url), 'utf8');
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
const nodes = new Map([...source.matchAll(/<node\b([^>]*?)(?:\/>|>[\s\S]*?<\/node>)/g)].map((match) => {
  const data = attrs(match[1]);
  return [data.id, [Number(data.lon), Number(data.lat)]];
}));
const ways = [...source.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)].map((match) => ({
  id: attrs(match[1]).id,
  refs: [...match[2].matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((node) => node[1]),
  tags: Object.fromEntries([...match[2].matchAll(/<tag\b([^>]*)\/>/g)].map((tag) => { const data = attrs(tag[1]); return [data.k, data.v]; })),
}));
const allowed = new Set(['footway', 'path', 'pedestrian', 'residential', 'living_street', 'service', 'cycleway', 'tertiary']);
const graph = new Map();
const add = (a, b, way) => {
  if (!nodes.has(a) || !nodes.has(b)) return;
  if (!graph.has(a)) graph.set(a, []);
  const weight = ['footway', 'path', 'pedestrian'].includes(way.tags.highway) ? 1 : 1.15;
  graph.get(a).push({ to: b, cost: distanceMeters(nodes.get(a), nodes.get(b)) * weight, wayId: way.id });
};
for (const way of ways) {
  if (!allowed.has(way.tags.highway) || ['private', 'no'].includes(way.tags.access) || way.tags.foot === 'no') continue;
  for (let index = 1; index < way.refs.length; index += 1) { add(way.refs[index - 1], way.refs[index], way); add(way.refs[index], way.refs[index - 1], way); }
}
const nearest = (point) => [...graph.keys()].sort((a, b) => distanceMeters(point, nodes.get(a)) - distanceMeters(point, nodes.get(b)))[0];
function shortest(start, end) {
  const costs = new Map([[start, 0]]);
  const previous = new Map();
  const queue = new Set([start]);
  while (queue.size) {
    const current = [...queue].sort((a, b) => costs.get(a) - costs.get(b))[0];
    queue.delete(current);
    if (current === end) break;
    for (const edge of graph.get(current) || []) {
      const next = costs.get(current) + edge.cost;
      if (next < (costs.get(edge.to) ?? Infinity)) { costs.set(edge.to, next); previous.set(edge.to, { node: current, wayId: edge.wayId }); queue.add(edge.to); }
    }
  }
  if (!costs.has(end)) throw new Error(`No connected route: ${start} -> ${end}`);
  const path = [end]; const wayIds = [];
  while (path[0] !== start) { const step = previous.get(path[0]); path.unshift(step.node); wayIds.unshift(step.wayId); }
  return { path, wayIds };
}

// Chosen checkpoints select an existing connected neighborhood loop. Every segment is an OSM way edge.
const checkpoints = [[127.02170, 37.65270], [127.020735, 37.653765], [127.0246052, 37.6542487], [127.0253, 37.6512], [127.02170, 37.65270]];
const checkpointIds = checkpoints.map(nearest);
const routeNodeIds = []; const sourceWayIds = [];
for (let index = 1; index < checkpointIds.length; index += 1) {
  const leg = shortest(checkpointIds[index - 1], checkpointIds[index]);
  routeNodeIds.push(...(index > 1 ? leg.path.slice(1) : leg.path));
  sourceWayIds.push(...leg.wayIds);
}
const coordinates = routeNodeIds.map((id) => nodes.get(id));
const bbox = [Math.min(...coordinates.map((p) => p[0])), Math.min(...coordinates.map((p) => p[1])), Math.max(...coordinates.map((p) => p[0])), Math.max(...coordinates.map((p) => p[1]))];
const uniqueWayIds = [...new Set(sourceWayIds)];
const route = {
  type: 'Feature',
  bbox,
  properties: {
    name: '쌍문 근린공원 · 동네길 예시 러닝', demo: true, actualUserRun: false, source: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/api/0.6/map?bbox=127.016,37.647,127.028,37.658',
    attribution: '© OpenStreetMap contributors · ODbL', downloadedAt: new Date().toISOString().slice(0, 10),
    description: '실제 OSM 보행로와 생활도로 노드를 연결한 편집기·지도 테스트용 폐회로입니다. 실제 사용자 운동 기록이 아니며 현장 통행 가능 여부는 별도 확인해야 합니다.',
    distanceMeters: Math.round(routeLengthMeters(coordinates)), closedLoop: routeNodeIds[0] === routeNodeIds.at(-1),
    suggestedZoom: 17, sourceWayIds: uniqueWayIds, sourceNodeIds: routeNodeIds,
    roadNames: [...new Set(ways.filter((way) => uniqueWayIds.includes(way.id)).map((way) => way.tags.name || way.tags.highway))],
  },
  geometry: { type: 'LineString', coordinates },
};
fs.writeFileSync(new URL('./assets/ssangmun-running-route.geojson', import.meta.url), JSON.stringify(route, null, 2) + '\n');
console.log(JSON.stringify({ ...route.properties, sourceNodeIds: undefined, bbox, coordinateCount: coordinates.length, uniqueNodes: new Set(routeNodeIds).size }, null, 2));
