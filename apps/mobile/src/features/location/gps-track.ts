export type RecordedTrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
  breakBefore?: boolean;
};

export function haversineKm(left: RecordedTrackPoint, right: RecordedTrackPoint) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(rad(right.latitude - left.latitude) / 2) ** 2 +
    Math.cos(rad(left.latitude)) *
      Math.cos(rad(right.latitude)) *
      Math.sin(rad(right.longitude - left.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function appendTrackPoint(points: RecordedTrackPoint[], next: RecordedTrackPoint) {
  if (
    !Number.isFinite(next.latitude) ||
    !Number.isFinite(next.longitude) ||
    !Number.isFinite(next.timestamp) ||
    Math.abs(next.latitude) > 85 ||
    Math.abs(next.longitude) > 180
  )
    return points;
  if (next.accuracy !== null && (next.accuracy < 0 || next.accuracy > 120)) return points;
  const previous = points.at(-1);
  if (!previous) return [next];
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0 || points.length >= 30000) return points;
  // Do not bridge an unrecorded pause or loss of GPS with a fabricated line/distance.
  if (next.breakBefore || seconds > 30) return [...points, { ...next, breakBefore: true }];
  const meters = haversineKm(previous, next) * 1000;
  if (meters < 1.5 || meters / seconds > 45) return points;
  return [...points, next];
}

export function calculateTrackDistance(points: RecordedTrackPoint[]) {
  return points
    .slice(1)
    .reduce(
      (total, point, i) => total + (point.breakBefore ? 0 : haversineKm(points[i]!, point)),
      0,
    );
}
