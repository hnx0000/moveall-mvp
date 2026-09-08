import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Extract an attributed, version-pinned subset; never synthesize boundary points.
const commit = '7360288277dfd12d74e54b959c59bdd66f852e3a';
const source = `https://raw.githubusercontent.com/vuski/admdongkor/${commit}/ver20260701/HangJeongDong_ver20260701.geojson`;
const response = await fetch(source);
if (!response.ok) throw new Error(`Boundary download failed: ${response.status}`);
const sourceText = await response.text();
const collection = JSON.parse(sourceText);
const features = collection.features.filter(feature =>
  feature.properties.adm_nm.startsWith('서울특별시 도봉구 '));
if (features.length !== 14) throw new Error(`Expected 14 Dobong dongs; found ${features.length}`);
const target = features.find(feature => feature.properties.adm_cd2 === '1132066000');
if (!target || !target.properties.adm_nm.endsWith('쌍문1동')) throw new Error('Missing Ssangmun1-dong');

function positions(coordinates) {
  return typeof coordinates[0] === 'number' ? [coordinates] : coordinates.flatMap(positions);
}
function bounds(featureList) {
  const points = featureList.flatMap(feature => positions(feature.geometry.coordinates));
  if (!points.every(([lng, lat]) => lng > 126 && lng < 128 && lat > 37 && lat < 38)) {
    throw new Error('Coordinates outside expected Seoul WGS84 bounds');
  }
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
function summarize(featureList) {
  const bbox = bounds(featureList);
  return { bbox, bboxCenter: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    coordinateCount: featureList.flatMap(f => positions(f.geometry.coordinates)).length };
}
const attribution = '통계청 SGIS 행정동 경계(공공누리 제1유형), 가공: vuski/admdongkor(CC BY 4.0)';
const result = {
  type: 'FeatureCollection',
  name: 'Dobong-gu administrative dongs (2026-07-01)',
  bbox: bounds(features),
  source: { url: source, date: '2026-07-01', commit, crs: 'EPSG:4326', attribution,
    license: 'https://github.com/vuski/admdongkor/blob/master/LICENSE-DATA',
    originalSha256: createHash('sha256').update(sourceText).digest('hex'),
    modified: 'Subset selection only. Original properties and coordinates retained without simplification.' },
  features,
};
await writeFile(new URL('./assets/dobong-dongs.geojson', import.meta.url), `${JSON.stringify(result)}\n`);
console.log(JSON.stringify({ count: features.length, dobong: summarize(features),
  ssangmun1: { ...target.properties, ...summarize([target]) },
  names: features.map(f => f.properties.adm_nm), source }, null, 2));
