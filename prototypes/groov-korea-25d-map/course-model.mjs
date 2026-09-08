import { routeLengthMeters, distanceMeters as haversineMeters } from "./route-model.mjs";

export const MAX_COURSE_PINS = 30;
// Deployed BRouter has no walking/fast-foot profile. Foot modes use the supported
// pedestrian profile with explicit difficulty/terrain preferences, not car routes.
export const COURSE_PROFILES = { running: "hiking-mountain", cycling: "trekking", hiking: "hiking-mountain" };
export function validCoordinate(point) {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= 124 &&
    point[0] <= 132.5 &&
    point[1] >= 32.8 &&
    point[1] <= 39
  );
}
export function validatePins(pins) {
  if (!Array.isArray(pins) || pins.length < 2 || pins.length > MAX_COURSE_PINS || !pins.every(validCoordinate))
    throw new Error("대한민국 지도에 출발점과 도착점을 포함해 2~30개 핀을 찍어주세요.");
  for (let i = 1; i < pins.length; i++)
    if (haversineMeters(pins[i - 1], pins[i]) < 8)
      throw new Error("바로 앞 핀에서 8m 이상 떨어진 위치를 선택해주세요.");
  return pins.map((p) => p.slice(0, 2));
}
export function routingUrl(pins, sport, options = {}, endpoint = "https://brouter.de/brouter") {
  validatePins(pins);
  if (!COURSE_PROFILES[sport]) throw new Error("러닝, 사이클 또는 등산을 선택해주세요.");
  const url = new URL(endpoint);
  url.searchParams.set(
    "lonlats",
    pins
      .map((p) =>
        p
          .slice(0, 2)
          .map((n) => n.toFixed(6))
          .join(","),
      )
      .join("|"),
  );
  url.searchParams.set("profile", COURSE_PROFILES[sport]);
  url.searchParams.set("alternativeidx", "0");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("profile:allow_ferries", "0");
  url.searchParams.set("profile:add_beeline", "0");
  if (sport !== "cycling") url.searchParams.set("profile:SAC_scale_limit", "1");
  url.searchParams.set("profile:consider_river", options.river ? "1" : "0");
  url.searchParams.set("profile:consider_forest", sport === "hiking" || options.park ? "1" : "0");
  url.searchParams.set("profile:consider_elevation", "1");
  url.searchParams.set('profile:consider_noise',options.quiet?'1':'0');
  if(sport==='cycling')url.searchParams.set('profile:consider_traffic',options.quiet?'1':'0');
  if (sport === "cycling") url.searchParams.set("profile:allow_steps", "0");
  return url;
}
export function parseRoutingResult(data, pins, sport) {
  validatePins(pins);
  const line = data?.features?.find((f) => f.geometry?.type === "LineString");
  const coordinates = line?.geometry?.coordinates?.map((p) => p.slice(0, Number.isFinite(p[2]) && p[2]>-500 && p[2]<9000 ? 3 : 2));
  if (
    !coordinates ||
    coordinates.length < 2 ||
    coordinates.length > 40000 ||
    !coordinates.every(validCoordinate)
  )
    throw new Error("연결 가능한 도로 경로를 찾지 못했습니다. 핀을 가까운 도로로 옮겨주세요.");
  if (
    haversineMeters(coordinates[0], pins[0]) > 180 ||
    haversineMeters(coordinates.at(-1), pins.at(-1)) > 180
  )
    throw new Error("도로와 핀 사이 거리가 너무 큽니다. 다른 위치를 선택해주세요.");
  if (pins.some((pin) => distanceToRoute(pin, coordinates) > 180))
    throw new Error("경유 핀을 통과하지 않는 경로입니다. 핀 위치를 확인해주세요.");
  const distanceMeters = routeLengthMeters(coordinates);
  if (distanceMeters < 8 || distanceMeters > 500000)
    throw new Error("코스는 8m 이상, 500km 이하로 만들어주세요.");
  return {
    coordinates,
    distanceMeters: Math.round(distanceMeters),
    sport,
    pins,
    source: "BRouter / OpenStreetMap",
    profile: COURSE_PROFILES[sport],
    elevation: elevationSummary(coordinates),
    pathEvidence: routePathEvidence(line.properties?.messages),
  };
}

export function routePathEvidence(messages){
  if(!Array.isArray(messages)||!Array.isArray(messages[0]))return null;
  const header=messages[0],tagsIndex=header.indexOf('WayTags'),distanceIndex=header.indexOf('Distance');
  if(tagsIndex<0||distanceIndex<0)return null;
  let total=0,river=0,paths=0;
  for(const row of messages.slice(1)){
    const distance=Number(row[distanceIndex]),tags=String(row[tagsIndex]||'');
    if(!Number.isFinite(distance)||distance<0)continue;
    total+=distance;
    if(/(?:^|\s)highway=(cycleway|footway|path|pedestrian)(?:\s|$)/.test(tags))paths+=distance;
    if(Number(tags.match(/(?:^|\s)estimated_river_class=(\d+)(?:\s|$)/)?.[1])>=4)river+=distance;
  }
  return total?{riverShare:river/total,pathShare:paths/total,classifiedMeters:total}:null;
}

export function distanceToRoute(point, coordinates) {
  let best = Infinity;
  const scale = Math.cos(point[1] * Math.PI / 180);
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, (((point[0] - a[0]) * scale * dx) + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, haversineMeters(point, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
  }
  return best;
}

export function elevationSummary(coordinates) {
  if (!coordinates.length || coordinates.some(p => !Number.isFinite(p[2]))) return null;
  let ascent = 0, descent = 0, maxGrade = 0, anchor = coordinates[0], distance = 0;
  const samples = [{ distanceMeters: 0, elevationMeters: anchor[2] }];
  coordinates.slice(1).forEach((p, i) => {
    distance += haversineMeters(coordinates[i], p);
    samples.push({ distanceMeters: Math.round(distance), elevationMeters: p[2] });
    const horizontal = haversineMeters(anchor, p);
    // DEM noise at tiny segments must not turn into implausible slope statistics.
    if (horizontal >= 30) {
      const delta = p[2] - anchor[2];
      if (Math.abs(delta) >= 3) { ascent += Math.max(0, delta); descent += Math.max(0, -delta); }
      maxGrade = Math.max(maxGrade, Math.abs(delta) / horizontal * 100);
      anchor = p;
    }
  });
  const heights=coordinates.map(p=>p[2]);
  return { ascentMeters: Math.round(ascent), descentMeters: Math.round(descent), maxGradePercent: Math.round(maxGrade),
    minElevationMeters:Math.round(Math.min(...heights)),maxElevationMeters:Math.round(Math.max(...heights)),samples };
}

export function outboundPins(pins, turnaroundIndex = null) {
  validatePins(pins);
  if (turnaroundIndex === null) return pins.map(p => p.slice(0, 2));
  if (!Number.isInteger(turnaroundIndex) || turnaroundIndex < 1 || turnaroundIndex >= pins.length)
    throw new Error("반환점은 출발점 다음 핀부터 선택해주세요.");
  return pins.slice(0, turnaroundIndex + 1).map(p => p.slice(0, 2));
}

export function withReturnRoute(result, turnaroundIndex) {
  if (turnaroundIndex === null) return { ...result, turnaroundIndex: null };
  // Mirror the actual routed vertices, never recalculate a shortcut back home.
  const coordinates = [...result.coordinates.map(p => [...p]), ...result.coordinates.slice(0, -1).reverse().map(p => [...p])];
  const elevation=elevationSummary(coordinates);
  if(elevation && result.elevation){
    elevation.ascentMeters=elevation.descentMeters=result.elevation.ascentMeters+result.elevation.descentMeters;
    elevation.maxGradePercent=result.elevation.maxGradePercent;
  }
  return { ...result, coordinates, distanceMeters: Math.round(routeLengthMeters(coordinates)), turnaroundIndex,elevation };
}
export function validateCourse(input) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 60) throw new Error("코스 이름은 1~60자로 입력해주세요.");
  if (!COURSE_PROFILES[input.sport]) throw new Error("알 수 없는 종목입니다.");
  const pins = validatePins(input.pins);
  const turnaroundIndex = input.turnaroundIndex ?? null;
  const outward = outboundPins(pins, turnaroundIndex);
  let coordinates = input.coordinates;
  if (turnaroundIndex !== null) {
    if (!Array.isArray(coordinates) || coordinates.length % 2 !== 1 || coordinates.some((p, i) =>
      !Array.isArray(p) || p.some((v, axis) => v !== coordinates[coordinates.length - 1 - i]?.[axis])))
      throw new Error("왕복 코스의 귀환 경로가 출발 경로와 일치하지 않습니다.");
    coordinates = coordinates.slice(0, (coordinates.length + 1) / 2);
  }
  const result = parseRoutingResult(
    { features: [{ geometry: { type: "LineString", coordinates } }] },
    outward,
    input.sport,
  );
  return { name, ...withReturnRoute(result, turnaroundIndex), pins };
}
