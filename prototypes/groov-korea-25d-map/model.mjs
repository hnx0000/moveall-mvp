export const PROVINCE_NAMES = {
  11: "서울",
  21: "부산",
  22: "대구",
  23: "인천",
  24: "광주",
  25: "대전",
  26: "울산",
  29: "세종",
  31: "경기",
  32: "강원",
  33: "충북",
  34: "충남",
  35: "전북",
  36: "전남",
  37: "경북",
  38: "경남",
  39: "제주",
};

const LEADER_SCORES = {
  11040: 997_400,
  21140: 985_600,
  31023: 971_800,
  11230: 959_900,
  21090: 948_200,
};

export function buildDistrictModel(features) {
  return features.map((feature, index) => {
    const code = String(feature.properties.code);
    const numeric = Number(code) || index + 1;
    const generatedHeat = 29 + ((numeric * 17 + index * 31) % 70);
    const score = LEADER_SCORES[code] ?? 286_000 + generatedHeat * 6_130 + (numeric % 8_870);
    const members = 720 + ((numeric * 13 + index * 71) % 4_900);
    const participationRate = Math.min(94, 24 + generatedHeat * 0.61 + (numeric % 7));
    return {
      code,
      name: feature.properties.name,
      provinceCode: code.slice(0, 2),
      province: PROVINCE_NAMES[code.slice(0, 2)] ?? code.slice(0, 2),
      score,
      heat: generatedHeat,
      members,
      participants: Math.round(members * participationRate / 100),
      participationRate,
      todayDelta: 280 + ((numeric * 9 + index * 83) % 3_240),
      center: feature.properties.center,
      bounds: feature.properties.bounds,
      feature,
    };
  });
}

export function rankDistricts(districts) {
  return [...districts]
    .sort((a, b) => b.score - a.score || b.participationRate - a.participationRate || a.code.localeCompare(b.code))
    .map((district, index) => ({ ...district, rank: district.live ? district.serverRank : index + 1 }));
}

export function aggregateProvinces(districts) {
  const buckets = new Map();
  for (const district of districts) {
    const bucket = buckets.get(district.provinceCode) ?? [];
    bucket.push(district);
    buckets.set(district.provinceCode, bucket);
  }
  return [...buckets.entries()].map(([provinceCode, areas]) => {
    const members = areas.reduce((sum, area) => sum + area.members, 0);
    const participants = areas.reduce((sum, area) => sum + area.participants, 0);
    const pointAverage = average(areas.map((area) => area.score));
    const score = areas.some(area => area.live) ? areas.reduce((sum, area) => sum + area.score, 0) : Math.round(pointAverage * Math.sqrt(areas.length) * 1.72);
    return {
      code: provinceCode,
      name: PROVINCE_NAMES[provinceCode] ?? provinceCode,
      score,
      heat: Math.round(average(areas.map((area) => area.heat))),
      members,
      participants,
      participationRate: members ? participants / members * 100 : 0,
      todayDelta: areas.reduce((sum, area) => sum + area.todayDelta, 0),
      center: weightedCenter(areas),
      bounds: mergeBounds(areas.map((area) => area.bounds)),
      districtCount: areas.length,
    };
  }).sort((a, b) => b.score - a.score).map((area, index) => ({ ...area, rank: index + 1 }));
}

export function classifyHeat(heat) {
  if (heat >= 82) return "overheat";
  if (heat >= 62) return "battle";
  return "stable";
}

export function applyLiveTick(districts, tick) {
  if (!districts.length) return districts;
  const count = Math.min(7, Math.max(3, Math.round(districts.length / 38)));
  const targets = new Set();
  let cursor = 0;
  while (targets.size < count && cursor < districts.length * 3) {
    targets.add((tick * 47 + cursor * 73 + 11) % districts.length);
    cursor += 1;
  }
  return districts.map((district, index) => {
    if (!targets.has(index)) return district;
    const gain = 190 + ((Number(district.code) * 19 + tick * 313 + index * 37) % 2_680);
    const participantGain = 1 + ((tick + index) % 9);
    const participants = Math.min(district.members, district.participants + participantGain);
    const participationRate = district.members ? participants / district.members * 100 : 0;
    return {
      ...district,
      score: district.score + gain,
      heat: Math.min(100, district.heat + (gain > 2_000 ? 1 : 0)),
      participants,
      participationRate,
      todayDelta: district.todayDelta + gain,
      lastGain: gain,
    };
  });
}

export function formatPoints(value, compact = false) {
  const safe = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  if (compact && safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(2)}M`;
  if (compact && safe >= 100_000) return `${(safe / 1_000).toFixed(1)}K`;
  return safe.toLocaleString("ko-KR");
}

export function totalsFor(districts) {
  return {
    score: districts.reduce((sum, district) => sum + district.score, 0),
    participants: districts.reduce((sum, district) => sum + district.participants, 0),
    overheat: districts.filter((district) => classifyHeat(district.heat) === "overheat").length,
  };
}

function weightedCenter(areas) {
  const total = areas.reduce((sum, area) => sum + Math.max(1, area.members), 0);
  return [
    areas.reduce((sum, area) => sum + area.center[0] * Math.max(1, area.members), 0) / total,
    areas.reduce((sum, area) => sum + area.center[1] * Math.max(1, area.members), 0) / total,
  ];
}

function mergeBounds(boundsList) {
  const valid = boundsList.filter(Boolean);
  if (!valid.length) return [[124.5, 33], [131.9, 38.7]];
  return valid.reduce((bounds, next) => [
    [Math.min(bounds[0][0], next[0][0]), Math.min(bounds[0][1], next[0][1])],
    [Math.max(bounds[1][0], next[1][0]), Math.max(bounds[1][1], next[1][1])],
  ]);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
