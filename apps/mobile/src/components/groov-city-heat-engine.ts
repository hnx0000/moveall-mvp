import type { KoreaMunicipality } from "../assets/korea-municipal-paths.ts";

export type HeatView = { x: number; y: number; width: number; height: number };
export type HeatLevel = "country" | "province" | "district";
export type LandmarkKind = "spire" | "arena" | "gate" | "outpost";

export type HeatFront = {
  key: string;
  name: string;
  rank: number;
  score: number;
  heat: number;
  members: number;
  participants: number;
  participationRate: number;
  todayDelta: number;
  center: [number, number];
  landmark: LandmarkKind;
};

export type DistrictFront = HeatFront & KoreaMunicipality;

// The generated geometry lives inside this tighter national stage. Keeping the
// viewBox close to the real bounds prevents the game board from shrinking into
// an empty canvas on tall phones.
export const HEAT_COUNTRY_VIEW: HeatView = { x: 35, y: 0, width: 245, height: 260 };
export const HEAT_MY_PROVINCE = "서울";
export const HEAT_MY_DISTRICT = "11100";

const provinceLabel: Record<string, string> = {
  서울: "서울",
  부산: "부산",
  대구: "대구",
  인천: "인천",
  광주: "광주",
  대전: "대전",
  울산: "울산",
  세종: "세종",
  경기: "경기",
  강원: "강원",
  충북: "충북",
  충남: "충남",
  전북: "전북",
  전남: "전남",
  경북: "경북",
  경남: "경남",
  제주: "제주",
};

export function compactProvince(name: string) {
  return provinceLabel[name] ?? name.replace(/특별자치도|특별자치시|광역시|특별시|도$/g, "");
}

export function landmarkFor(rank: number): LandmarkKind {
  if (rank === 1) return "spire";
  if (rank === 2) return "arena";
  if (rank === 3) return "gate";
  return "outpost";
}

export function createProvinceFronts(areas: readonly KoreaMunicipality[]): HeatFront[] {
  const groups = new Map<string, KoreaMunicipality[]>();
  for (const area of areas) groups.set(area.province, [...(groups.get(area.province) ?? []), area]);
  const raw = [...groups.entries()].map(([province, provinceAreas]) => {
    const heat = average(provinceAreas.map((area) => area.heat));
    const seed = [...province].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const members = provinceAreas.reduce((sum, area) => sum + 830 + (Number(area.code) % 2970), 0);
    const participationRate = Math.min(88, 28 + heat * 0.47 + (seed % 7));
    return {
      key: province,
      name: compactProvince(province),
      score: Math.round(
        provinceAreas.reduce((sum, area) => sum + 21_000 + area.heat * 344 + (Number(area.code) % 787), 0) /
          Math.sqrt(provinceAreas.length),
      ),
      heat,
      members,
      participants: Math.round(members * participationRate / 100),
      participationRate,
      todayDelta: Math.round(380 + heat * 12 + provinceAreas.length * 9),
      center: [
        average(provinceAreas.map((area) => area.center[0])),
        average(provinceAreas.map((area) => area.center[1])),
      ] as [number, number],
    };
  });
  return rankFronts(raw);
}

export function createDistrictFronts(
  areas: readonly KoreaMunicipality[],
  overrides: Readonly<Record<string, number>> = {},
): DistrictFront[] {
  const raw = areas.map((area) => {
    const numeric = Number(area.code) || 0;
    const score = Math.round(overrides[area.code] ?? 39_000 + area.heat * 512 + (numeric % 2330));
    const members = 740 + ((numeric * 13) % 4380);
    const participationRate = Math.min(89, 25 + area.heat * 0.48 + (numeric % 8));
    return {
      ...area,
      key: area.code,
      score,
      members,
      participants: Math.round(members * participationRate / 100),
      participationRate,
      todayDelta: 74 + ((numeric + area.heat * 3) % 390),
    };
  });
  const ranked = rankFronts(raw);
  return ranked.map((front) => ({
    ...raw.find((area) => area.code === front.key)!,
    ...front,
  }));
}

export function heatColor(heat: number, selected = false, muted = false) {
  if (selected) return "url(#heat-selected)";
  const value = clamp(heat, 0, 100);
  const color = value >= 78 ? "#F34A25" : value >= 60 ? "#A83620" : value >= 42 ? "#5D291E" : "#27211F";
  return muted ? `${color}A8` : color;
}

export function formatHeat(value: number, compact = false) {
  const score = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  if (compact && score >= 1_000_000) return `${(score / 1_000_000).toFixed(2)}M`;
  if (compact && score >= 100_000) return `${(score / 1_000).toFixed(1)}K`;
  return score.toLocaleString("ko-KR");
}

export function provinceView(areas: readonly KoreaMunicipality[]): HeatView {
  if (!areas.length) return HEAT_COUNTRY_VIEW;
  const xs = areas.map((area) => area.center[0]);
  const ys = areas.map((area) => area.center[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(7, maxX - minX);
  const spanY = Math.max(8, maxY - minY);
  const width = Math.max(spanX * 1.48, spanY * 1.18);
  const height = Math.max(spanY * 1.5, width * 0.88);
  return clampView({
    x: (minX + maxX) / 2 - width / 2,
    y: (minY + maxY) / 2 - height / 2,
    width,
    height,
  });
}

export function focusView(center: [number, number], baseWidth: number) {
  const width = clamp(baseWidth, 4.8, 40);
  return clampView({ x: center[0] - width / 2, y: center[1] - width * 0.42, width, height: width * 0.84 });
}

export function zoomHeatView(view: HeatView, factor: number) {
  const width = clamp(view.width * factor, 4.8, HEAT_COUNTRY_VIEW.width);
  const height = clamp(view.height * factor, 4, HEAT_COUNTRY_VIEW.height);
  return clampView({
    x: view.x + (view.width - width) / 2,
    y: view.y + (view.height - height) / 2,
    width,
    height,
  });
}

export function panHeatView(view: HeatView, dx: number, dy: number, width: number, height: number) {
  if (width <= 0 || height <= 0) return view;
  return clampView({
    ...view,
    x: view.x - dx / width * view.width,
    y: view.y - dy / height * view.height,
  });
}

export function assertHeatGeometry(areas: readonly KoreaMunicipality[]) {
  const unique = new Set(areas.map((area) => area.code));
  return {
    valid: areas.length > 200 && unique.size === areas.length && areas.every((area) => area.path.startsWith("M")),
    count: areas.length,
    seoulCount: areas.filter((area) => area.province === "서울").length,
  };
}

function rankFronts<T extends Omit<HeatFront, "rank" | "landmark">>(fronts: readonly T[]): (T & Pick<HeatFront, "rank" | "landmark">)[] {
  const sorted = [...fronts].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const ranks = new Map(sorted.map((front, index) => [front.key, index + 1]));
  return fronts.map((front) => {
    const rank = ranks.get(front.key) ?? fronts.length;
    return { ...front, rank, landmark: landmarkFor(rank) };
  });
}

function clampView(view: HeatView): HeatView {
  const width = Math.min(view.width, HEAT_COUNTRY_VIEW.width);
  const height = Math.min(view.height, HEAT_COUNTRY_VIEW.height);
  return {
    x: clamp(view.x, HEAT_COUNTRY_VIEW.x, HEAT_COUNTRY_VIEW.x + HEAT_COUNTRY_VIEW.width - width),
    y: clamp(view.y, HEAT_COUNTRY_VIEW.y, HEAT_COUNTRY_VIEW.y + HEAT_COUNTRY_VIEW.height - height),
    width,
    height,
  };
}

function average(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
