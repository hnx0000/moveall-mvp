import { readFile, writeFile } from "node:fs/promises";

const source = JSON.parse(
  await readFile(new URL("../apps/mobile/src/assets/skorea-municipalities-2018-topo-simple.json", import.meta.url), "utf8"),
);
const provinceNames = {
  11: "서울", 21: "부산", 22: "대구", 23: "인천", 24: "광주", 25: "대전", 26: "울산", 29: "세종",
  31: "경기", 32: "강원", 33: "충북", 34: "충남", 35: "전북", 36: "전남", 37: "경북", 38: "경남", 39: "제주",
};
const { scale, translate } = source.transform;
const decoded = source.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});
const geometries = Object.values(source.objects)[0].geometries;
const all = decoded.flat();
const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
const width = 300, height = 430, pad = 8;
const factor = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
const project = ([x, y]) => [pad + (x - minX) * factor, pad + (maxY - y) * factor];
function arcPoints(index) {
  const points = decoded[index < 0 ? ~index : index];
  return index < 0 ? [...points].reverse() : points;
}
function ringPath(ring) {
  const points = ring.flatMap((index, arcIndex) => {
    const arc = arcPoints(index);
    return arcIndex ? arc.slice(1) : arc;
  }).map(project);
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";
}
function geometryPath(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
  return polygons.flatMap((polygon) => polygon.map(ringPath)).join("");
}
const municipalities = geometries.map((geometry, index) => ({
  code: geometry.properties.code,
  name: geometry.properties.name,
  province: provinceNames[geometry.properties.code.slice(0, 2)],
  path: geometryPath(geometry),
  center: (() => {
    const paths = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
    const points = paths.flat(2).flatMap((arcIndex) => arcPoints(arcIndex)).map(project);
    return [+(points.reduce((sum, point) => sum + point[0], 0) / points.length).toFixed(1), +(points.reduce((sum, point) => sum + point[1], 0) / points.length).toFixed(1)];
  })(),
  heat: 24 + ((Number(geometry.properties.code) * 17 + index * 13) % 73),
}));
const output = `// Generated from KOSTAT 2018 municipality boundaries via southkorea-maps.\nexport type KoreaMunicipality = { code: string; name: string; province: string; path: string; center: [number, number]; heat: number };\nexport const koreaMunicipalities: KoreaMunicipality[] = ${JSON.stringify(municipalities)};\n`;
await writeFile(new URL("../apps/mobile/src/assets/korea-municipal-paths.ts", import.meta.url), output);
console.log(`Generated ${municipalities.length} municipality paths.`);
