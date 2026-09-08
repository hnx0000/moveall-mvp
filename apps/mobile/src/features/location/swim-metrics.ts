export function requiresOutdoorGps(sport: string, environment: "indoor" | "outdoor") {
  return (
    ["running", "hiking", "cycling"].includes(sport) ||
    (sport === "swimming" && environment === "outdoor")
  );
}
export function indoorSwimMetrics(pool: string, lengths: string) {
  const poolLengthM = Number(pool);
  if (!Number.isFinite(poolLengthM) || poolLengthM < 10 || poolLengthM > 100) {
    return {
      error: "수영장 길이를 10~100m로 설정해 주세요.",
      distanceM: undefined,
      laps: undefined,
    };
  }
  if (!lengths.trim()) return { error: null, distanceM: undefined, laps: undefined };
  const count = Number(lengths);
  if (!Number.isInteger(count) || count < 0 || count > 10000) {
    return {
      error: "완료한 편도 횟수는 0~10,000 사이의 정수로 입력해 주세요.",
      distanceM: undefined,
      laps: undefined,
    };
  }
  return { error: null, distanceM: poolLengthM * count, laps: count };
}
