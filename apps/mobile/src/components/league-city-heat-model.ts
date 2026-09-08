import type { KoreaMunicipality } from "../assets/korea-municipal-paths";
import {
  NATIONAL_VIEW,
  SEOUL_VIEW,
  type LeagueViewport,
} from "./league-map-model.ts";

export type CityHeatMapLevel = "country" | "seoul" | "district";
export type LandmarkTier = "tower" | "arena" | "beacon" | "base";
export type HeatBand = "quiet" | "active" | "burning" | "critical";

export type CityHeatStanding = KoreaMunicipality & {
  rank: number;
  score: number;
  memberCount: number;
  participantCount: number;
  participationRate: number;
  verifiedActivityCount: number;
  scoreDelta: number;
  rankDelta: number;
  dominantSport: string;
  landmark: LandmarkTier;
  heatBand: HeatBand;
};

export const CITY_HEAT_MY_REGION = "11100";
export const CITY_HEAT_VIEWS: Record<CityHeatMapLevel, LeagueViewport> = {
  country: NATIONAL_VIEW,
  seoul: SEOUL_VIEW,
  district: SEOUL_VIEW,
};

const sports = ["러닝", "근력", "사이클", "등산", "수영", "다이빙"] as const;

export function safeFinite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatCityHeatScore(value: unknown, compact = false) {
  const score = Math.max(0, Math.round(safeFinite(value)));
  if (compact && score >= 100_000) return `${(score / 1000).toFixed(score >= 1_000_000 ? 0 : 1)}K`;
  return score.toLocaleString("ko-KR");
}

export function formatCityHeatRank(value: unknown) {
  const rank = Math.max(1, Math.round(safeFinite(value, 1)));
  return `#${rank.toLocaleString("ko-KR")}`;
}

export function heatBand(heat: unknown): HeatBand {
  const normalized = Math.max(0, Math.min(100, safeFinite(heat)));
  if (normalized >= 76) return "critical";
  if (normalized >= 58) return "burning";
  if (normalized >= 38) return "active";
  return "quiet";
}

export function heatFill(heat: unknown, selected = false, dimmed = false) {
  if (selected) return "#FF5832";
  const band = heatBand(heat);
  const colors: Record<HeatBand, string> = {
    quiet: "#2B2421",
    active: "#6E3022",
    burning: "#B83F25",
    critical: "#F24924",
  };
  return dimmed ? `${colors[band]}88` : colors[band];
}

export function landmarkForRank(rank: number): LandmarkTier {
  if (rank === 1) return "tower";
  if (rank === 2) return "arena";
  if (rank === 3) return "beacon";
  return "base";
}

export function createCityHeatStandings(
  areas: readonly KoreaMunicipality[],
  scoreOverrides: Readonly<Record<string, number>> = {},
) {
  const enriched = areas.map((area) => {
    const numericCode = Number(area.code) || 0;
    const baseScore = 42_000 + safeFinite(area.heat) * 465 + (numericCode % 1710);
    const score = Math.max(0, Math.round(scoreOverrides[area.code] ?? baseScore));
    const memberCount = 920 + ((numericCode * 7) % 5300);
    const participantCount = Math.max(0, Math.round(memberCount * (0.24 + area.heat / 240)));
    const participationRate = memberCount > 0 ? (participantCount / memberCount) * 100 : 0;
    return {
      ...area,
      score,
      memberCount,
      participantCount,
      participationRate,
      verifiedActivityCount: 78 + ((numericCode + area.heat * 5) % 240),
      scoreDelta: 54 + ((numericCode + area.heat) % 260),
      rankDelta: ((numericCode + area.heat) % 5) - 2,
      dominantSport: sports[(numericCode + area.heat) % sports.length] ?? "러닝",
      heatBand: heatBand(area.heat),
    };
  });

  const sorted = [...enriched].sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const rankByCode = new Map(sorted.map((area, index) => [area.code, index + 1]));
  return enriched.map<CityHeatStanding>((area) => {
    const rank = rankByCode.get(area.code) ?? areas.length;
    return { ...area, rank, landmark: landmarkForRank(rank) };
  });
}

export function findNearestRivals(
  standings: readonly CityHeatStanding[],
  selectedCode: string,
  limit = 2,
) {
  const selected = standings.find((area) => area.code === selectedCode);
  if (!selected) return [];
  return standings
    .filter((area) => area.code !== selectedCode)
    .sort((a, b) => Math.abs(a.score - selected.score) - Math.abs(b.score - selected.score))
    .slice(0, Math.max(0, limit));
}

export function scoreAfterContribution(current: unknown, contribution: unknown) {
  return Math.max(0, Math.round(safeFinite(current) + Math.max(0, safeFinite(contribution))));
}

export function assertCityHeatMapData(areas: readonly KoreaMunicipality[]) {
  const seoul = areas.filter((area) => area.province === "서울");
  const uniqueCodes = new Set(areas.map((area) => area.code));
  const validGeometry = areas.every(
    (area) =>
      area.code &&
      area.name &&
      area.path.startsWith("M") &&
      area.center.length === 2 &&
      area.center.every(Number.isFinite),
  );
  return {
    valid: areas.length > 0 && seoul.length === 25 && uniqueCodes.size === areas.length && validGeometry,
    seoulCount: seoul.length,
    duplicateCodeCount: areas.length - uniqueCodes.size,
    validGeometry,
  };
}
