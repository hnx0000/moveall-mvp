import type { WorkoutRoutePoint, WorkoutSession } from "@moveall/contracts";

export const STUDIO_WIDTH = 360;
export const STUDIO_HEIGHT = 640;
export const ROUTE_ORANGE = "#FF5A32";
export type XY = { x: number; y: number; breakBefore?: boolean };
export type StudioLayer = {
  id: string;
  kind: "text" | "metric" | "sport" | "route" | "brand" | "group";
  children?: StudioLayer[];
  text: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  color: string;
  visible: boolean;
  textAlign?: "left" | "center" | "right";
};
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function projectRoute(points: readonly WorkoutRoutePoint[]) {
  let previousX = points.length ? (points[0]!.longitude + 180) / 360 : 0;
  return points.map((point): XY => {
    let x = (point.longitude + 180) / 360;
    while (x - previousX > 0.5) x -= 1;
    while (x - previousX < -0.5) x += 1;
    previousX = x;
    const latitude = (clamp(point.latitude, -85, 85) * Math.PI) / 180;
    return {
      x,
      y: (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2,
      ...(point.breakBefore ? { breakBefore: true } : {}),
    };
  });
}

export function routeBounds(points: readonly XY[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function fitRouteMap(points: readonly WorkoutRoutePoint[]) {
  const world = projectRoute(points);
  if (!world.length) return null;
  const b = routeBounds(world);
  const zoom = clamp(
    Math.log2(
      Math.min(280 / Math.max(b.maxX - b.minX, 1e-9), 370 / Math.max(b.maxY - b.minY, 1e-9)) / 512,
    ),
    1,
    18,
  );
  const scale = 512 * 2 ** zoom;
  const centerX = (b.minX + b.maxX) / 2;
  // Leave room for editable statistics in the lower part of the portrait.
  const centerY = (b.minY + b.maxY) / 2 + 50 / scale;
  const longitude = ((centerX * 360 - 180 + 540) % 360) - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY))) * 180) / Math.PI;
  return {
    longitude,
    latitude,
    zoom,
    points: world.map((p) => ({
      ...p,
      x: 180 + (p.x - centerX) * scale,
      y: 320 + (p.y - centerY) * scale,
    })),
  };
}

export function detachedRoute(points: readonly WorkoutRoutePoint[]): XY[] {
  const projected = projectRoute(points);
  if (!projected.length) return [];
  const b = routeBounds(projected);
  const scale = Math.min(
    168 / Math.max(b.maxX - b.minX, 1e-9),
    188 / Math.max(b.maxY - b.minY, 1e-9),
  );
  return projected.map((p) => ({
    ...p,
    x: 90 + (p.x - (b.minX + b.maxX) / 2) * scale,
    y: 100 + (p.y - (b.minY + b.maxY) / 2) * scale,
  }));
}

export function routePath(points: readonly XY[]) {
  return points
    .map((p, i) => `${i === 0 || p.breakBefore ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

export function constrainLayer(layer: StudioLayer): StudioLayer {
  const angle = (layer.rotation * Math.PI) / 180;
  const rotatedWidth =
    Math.abs(layer.width * Math.cos(angle)) + Math.abs(layer.height * Math.sin(angle));
  const rotatedHeight =
    Math.abs(layer.width * Math.sin(angle)) + Math.abs(layer.height * Math.cos(angle));
  const scale = clamp(layer.scale, 0.35, Math.min(3, 350 / rotatedWidth, 620 / rotatedHeight));
  const halfW = (rotatedWidth * scale) / 2,
    halfH = (rotatedHeight * scale) / 2;
  return {
    ...layer,
    scale,
    x: clamp(layer.x, halfW + 5, 355 - halfW),
    y: clamp(layer.y, halfH + 5, 635 - halfH),
  };
}

export function layer(
  id: string,
  kind: StudioLayer["kind"],
  text: string,
  label: string,
  x: number,
  y: number,
  width = 150,
  height = 62,
): StudioLayer {
  return {
    id,
    kind,
    text,
    label,
    x,
    y,
    width,
    height,
    scale: 1,
    rotation: 0,
    color: "#FFFFFF",
    visible: true,
  };
}

export function workoutMetricLayers(workout: WorkoutSession): StudioLayer[] {
  const m = workout.metrics;
  const durationSeconds =
    (m.durationMinutes ?? (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 60000) *
    60;
  const clock = `${Math.floor(durationSeconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((durationSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(durationSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
  const metrics: [string, string, string][] = [["duration", "시간", clock]];
  const add = (key: string, label: string, unit: string, digits = 0) => {
    const value = m[key];
    if (value !== undefined && Number.isFinite(value))
      metrics.push([key, label, `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`]);
  };
  if (m.distanceKm !== undefined) add("distanceKm", "거리", "km", 2);
  else add("distanceM", "거리", "m");
  if (workout.sport === "cycling") add("averageSpeedKmh", "평균 속도", "km/h", 1);
  else {
    const key = workout.sport === "swimming" ? "swimPaceSeconds" : "paceSeconds";
    const pace = m[key];
    if (pace && pace > 0) {
      const seconds = Math.round(pace);
      metrics.push([
        key,
        "평균 페이스",
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /${workout.sport === "swimming" ? "100m" : "km"}`,
      ]);
    }
  }
  add("calories", "칼로리", "kcal");
  add("averageHeartRateBpm", "평균 심박수", "bpm");
  add("maximumHeartRateBpm", "최대 심박수", "bpm");
  add("steps", "걸음", "");
  add("averageCadenceSpm", "평균 케이던스", "spm");
  add("elevationGainM", "누적 고도", "m");
  add("exerciseCount", "종목", "");
  add("sets", "세트", "");
  add("volumeKg", "볼륨", "kg");
  add("laps", "LAP", "");
  add("totalStrokes", "총 스트로크", "");
  add("averageSwolf", "평균 SWOLF", "", 1);
  add("maxDepthM", "수심 PB", "m", 1);
  add("dynamicDistanceM", "다이내믹", "m");
  add("waterTemperatureC", "수온", "°C");
  return metrics.map(([id, labelText, value], i) => ({
    ...layer(
      `metric-${id}`,
      "metric",
      value,
      labelText,
      i % 2 ? 270 : 100,
      455 + Math.floor((i % 4) / 2) * 85,
    ),
    visible: i < 3,
  }));
}

export function initialLayers(workout: WorkoutSession): StudioLayer[] {
  return [
    layer("sport", "sport", "", "종목 로고", 48, 375, 48, 48),
    layer("title", "text", "오늘의 나를 기록하다.", "자유 텍스트", 180, 408, 308, 44),
    {
      ...layer("route", "route", "", "GPS 경로", 180, 220, 180, 200),
      color: ROUTE_ORANGE,
      visible: (workout.routePoints?.length ?? 0) > 1,
    },
    ...workoutMetricLayers(workout),
  ];
}

export function brandVisible(inApp: boolean, external: boolean) {
  return external || inApp;
}

export const STUDIO_BACKGROUNDS = [
  { label: "White", color: "#FFFFFF", ink: "#171513" },
  { label: "Black", color: "#171513", ink: "#FFFFFF" },
  { label: "GROOV Orange", color: ROUTE_ORANGE, ink: "#FFFFFF" },
] as const;

/** Explicit editor-only sample: never stored as a measured workout. */
export const SAMPLE_STUDIO_ROUTE: WorkoutRoutePoint[] = Array.from({ length: 65 }, (_, index) => {
  const angle = (index / 64) * Math.PI * 2;
  return {
    latitude: 37.511 + Math.sin(angle) * 0.0042,
    longitude: 127.102 + Math.cos(angle) * (0.0025 + 0.0004 * Math.sin(angle * 3)),
    timestamp: index * 10000,
    accuracy: 5,
    altitude: null,
  };
});

export function recordGroup(
  workout: WorkoutSession,
  color = "#FFFFFF",
  visibleMetricIds?: string[],
): StudioLayer {
  const metrics = workoutMetricLayers(workout).map((item, index) => ({
    ...item,
    x: index % 2 ? 239 : 81,
    y: 96 + Math.floor(index / 2) * 76,
    width: 146,
    height: 62,
    color,
    visible: visibleMetricIds ? visibleMetricIds.includes(item.id) : index < 3,
  }));
  let position = 0;
  for (const metric of metrics) {
    if (!metric.visible) continue;
    metric.x = position % 2 ? 239 : 81;
    metric.y = 96 + Math.floor(position / 2) * 76;
    position++;
  }
  const height = 68 + Math.ceil(Math.max(1, position) / 2) * 76;
  return constrainLayer({
    ...layer("record-group", "group", "", "기록 그룹", 180, 620 - height / 2, 320, height),
    color,
    children: [
      { ...layer("sport", "sport", "", "종목 로고", 30, 30, 40, 40), color },
      { ...layer("brand", "brand", "GROOV", "GROOV 로고", 248, 30, 126, 38), color },
      ...metrics,
    ],
  });
}

export function ungroupRecord(group: StudioLayer, preserveLayout = false): StudioLayer[] {
  const angle = (group.rotation * Math.PI) / 180;
  return (group.children ?? []).map((child) => {
    const dx = (child.x - group.width / 2) * group.scale;
    const dy = (child.y - group.height / 2) * group.scale;
    const flattened = {
      ...child,
      x: group.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: group.y + dx * Math.sin(angle) + dy * Math.cos(angle),
      scale: child.scale * group.scale,
      rotation: child.rotation + group.rotation,
    };
    return preserveLayout ? flattened : constrainLayer(flattened);
  });
}

/** Regroup the edited layers without resetting their placement, color or visibility. */
export function regroupRecord(children: StudioLayer[]): StudioLayer {
  if (!children.length) throw new Error("묶을 기록 레이어가 없습니다.");
  const bounds = children.map((child) => {
    const angle = (child.rotation * Math.PI) / 180;
    const w =
      ((Math.abs(child.width * Math.cos(angle)) + Math.abs(child.height * Math.sin(angle))) *
        child.scale) /
      2;
    const h =
      ((Math.abs(child.width * Math.sin(angle)) + Math.abs(child.height * Math.cos(angle))) *
        child.scale) /
      2;
    return { left: child.x - w, right: child.x + w, top: child.y - h, bottom: child.y + h };
  });
  const left = Math.min(...bounds.map((b) => b.left));
  const top = Math.min(...bounds.map((b) => b.top));
  const width = Math.max(...bounds.map((b) => b.right)) - left;
  const height = Math.max(...bounds.map((b) => b.bottom)) - top;
  return {
    ...layer(
      "record-group",
      "group",
      "",
      "기록 그룹",
      left + width / 2,
      top + height / 2,
      width,
      height,
    ),
    children: children.map((child) => ({ ...child, x: child.x - left, y: child.y - top })),
  };
}
