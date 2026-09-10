import type { LeagueWorkoutForScoring } from "@moveall/contracts";

type SampleRegion = { regionKey: string; regionName: string; province: string | null };
const seoul = ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"];
const knownKeys: Record<string, string> = { 도봉구: "kr:seoul:dobong", 강남구: "kr:seoul:gangnam", 마포구: "kr:seoul:mapo", 송파구: "kr:seoul:songpa" };
const names = ["새벽러너", "페이스메이커", "꾸준한민수", "물결지은", "오늘도한바퀴", "업힐준", "리프트수아", "파도유진", "동네한바퀴", "런앤칠", "주말등산러", "느린완주", "수영하는하루", "트랙태오", "오운완서연", "퇴근라이더", "산책부터", "다음한걸음"];
const sports = ["running", "cycling", "strength", "swimming", "hiking", "diving"] as const;

/** Synthetic records used only by demoApi's league; never saved into workout/feed history. */
export function demoLeagueWorkouts(seed: number, now: Date): LeagueWorkoutForScoring[] {
  return Array.from({ length: 18 }, (_, index) => {
    const sport = sports[index % sports.length]!;
    const minutes = 22 + ((seed * 11 + index * 7) % 62);
    const daysAgo = index < 6 ? 0 : 2 + ((index * 3 + seed) % 40);
    const endedAt = new Date(now.getTime() - daysAgo * 86_400_000 - (index % 6 + 1) * 90 * 60_000);
    const distanceKm = sport === "running" ? minutes / 6.2 : sport === "cycling" ? minutes / 2.9 : sport === "hiking" ? minutes / 16 : sport === "swimming" ? minutes / 36 : 0;
    return {
      sport,
      startedAt: new Date(endedAt.getTime() - minutes * 60_000).toISOString(),
      endedAt: endedAt.toISOString(),
      perceivedExertion: 4 + ((seed + index) % 4),
      metrics: {
        durationMinutes: minutes, distanceKm: Math.round(distanceKm * 100) / 100,
        calories: minutes * (sport === "running" ? 10 : 6),
        ...(sport === "strength" ? { sets: 12 + seed % 9, volumeKg: 1800 + seed % 15 * 240 } : {}),
        ...(sport === "diving" ? { maxDepthM: 8 + seed % 18, dynamicDistanceM: 25 + seed % 30 } : {}),
      },
    };
  });
}

export function demoLeagueParticipants(now: Date, viewerRegion: SampleRegion) {
  const regions: SampleRegion[] = [
    ...seoul.map((regionName) => ({ regionKey: knownKeys[regionName] ?? `demo:서울:${regionName}`, regionName, province: "서울" })),
    ...[["부산", "해운대구"], ["인천", "연수구"], ["대구", "수성구"], ["대전", "유성구"], ["광주", "북구"], ["울산", "남구"], ["경기", "수원시"], ["제주", "제주시"]].map(([province, regionName]) => ({ regionKey: `demo:${province}:${regionName}`, regionName: regionName!, province: province! })),
  ];
  const same = regions.findIndex((region) => region.regionName === viewerRegion.regionName && (region.province === viewerRegion.province || viewerRegion.province?.startsWith(region.province ?? "!")));
  if (same >= 0) regions[same] = viewerRegion;
  else regions.push(viewerRegion);
  return regions.flatMap((region, regionIndex) => Array.from({ length: 18 + regionIndex % 11 }, (_, index) => ({
    ...region,
    userId: `demo-league-sample-${regionIndex}-${index}`,
    displayName: `${names[index % names.length]}${index >= names.length ? index - names.length + 2 : ""}`,
    // Leave some members inactive so participation rates are meaningful, not uniformly 100%.
    workouts: index % 6 === regionIndex % 6 ? [] : demoLeagueWorkouts(regionIndex * 31 + index, now),
  })));
}
