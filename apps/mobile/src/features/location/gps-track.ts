export type RecordedTrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
  breakBefore?: boolean;
};

export type GpsTrackSport = "running" | "hiking" | "cycling" | "swimming" | "strength" | "diving";

export type TrackPointRejectReason =
  | "invalid"
  | "inaccurate"
  | "duplicate"
  | "stale"
  | "future"
  | "jitter"
  | "speed"
  | "acceleration"
  | "capacity";

export type TrackPointResult = {
  points: RecordedTrackPoint[];
  accepted: boolean;
  reason?: TrackPointRejectReason;
};

export type TrackPointValidationOptions = {
  /** Wall-clock time at receipt. Omit when replaying a previously recorded route. */
  receivedAt?: number;
  maxFutureSkewMs?: number;
};

type TrackProfile = {
  maxAccuracyM: number;
  maxSpeedMps: number;
  maxAccelerationMps2: number;
};

const profiles: Record<GpsTrackSport, TrackProfile> = {
  running: { maxAccuracyM: 35, maxSpeedMps: 12, maxAccelerationMps2: 8 },
  hiking: { maxAccuracyM: 40, maxSpeedMps: 8, maxAccelerationMps2: 6 },
  cycling: { maxAccuracyM: 35, maxSpeedMps: 35, maxAccelerationMps2: 12 },
  swimming: { maxAccuracyM: 45, maxSpeedMps: 6, maxAccelerationMps2: 5 },
  strength: { maxAccuracyM: 35, maxSpeedMps: 8, maxAccelerationMps2: 6 },
  diving: { maxAccuracyM: 45, maxSpeedMps: 6, maxAccelerationMps2: 5 },
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

export function appendTrackPointResult(
  points: RecordedTrackPoint[],
  next: RecordedTrackPoint,
  sport: GpsTrackSport = "running",
  options: TrackPointValidationOptions = {},
): TrackPointResult {
  const profile = profiles[sport];
  if (
    !Number.isFinite(next.latitude) ||
    !Number.isFinite(next.longitude) ||
    !Number.isFinite(next.timestamp) ||
    Math.abs(next.latitude) > 85 ||
    Math.abs(next.longitude) > 180
  ) {
    return { points, accepted: false, reason: "invalid" };
  }
  if (
    (next.accuracy !== null && !Number.isFinite(next.accuracy)) ||
    (next.altitude !== null && !Number.isFinite(next.altitude))
  ) {
    return { points, accepted: false, reason: "invalid" };
  }
  if (
    options.receivedAt !== undefined &&
    next.timestamp > options.receivedAt + (options.maxFutureSkewMs ?? 30_000)
  ) {
    return { points, accepted: false, reason: "future" };
  }
  if (next.accuracy !== null && (next.accuracy < 0 || next.accuracy > profile.maxAccuracyM)) {
    return { points, accepted: false, reason: "inaccurate" };
  }
  const previous = points.at(-1);
  if (!previous) return { points: [next], accepted: true };
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  if (seconds === 0 && next.latitude === previous.latitude && next.longitude === previous.longitude) {
    return { points, accepted: false, reason: "duplicate" };
  }
  if (seconds <= 0) return { points, accepted: false, reason: "stale" };
  if (points.length >= 30000) return { points, accepted: false, reason: "capacity" };
  // Do not bridge an unrecorded pause or loss of GPS with a fabricated line/distance.
  if (next.breakBefore || seconds > 30) {
    return { points: [...points, { ...next, breakBefore: true }], accepted: true };
  }
  const meters = haversineKm(previous, next) * 1000;
  const accuracyFloor = Math.min(
    8,
    Math.max(1.5, Math.max(previous.accuracy ?? 0, next.accuracy ?? 0) * 0.2),
  );
  if (meters < accuracyFloor) return { points, accepted: false, reason: "jitter" };
  const speedMps = meters / seconds;
  if (speedMps > profile.maxSpeedMps) {
    return { points, accepted: false, reason: "speed" };
  }

  const beforePrevious = points.at(-2);
  if (beforePrevious && !previous.breakBefore) {
    const previousSeconds = (previous.timestamp - beforePrevious.timestamp) / 1000;
    if (previousSeconds > 0 && previousSeconds <= 30) {
      const previousSpeed = (haversineKm(beforePrevious, previous) * 1000) / previousSeconds;
      const acceleration = Math.abs(speedMps - previousSpeed) / Math.max(seconds, 1);
      const outsideAccuracyEnvelope = meters > Math.max(12, (next.accuracy ?? 0) * 2);
      if (outsideAccuracyEnvelope && acceleration > profile.maxAccelerationMps2) {
        return { points, accepted: false, reason: "acceleration" };
      }
    }
  }

  // Accuracy-weighted smoothing removes small GPS zig-zags without hiding large real turns.
  const accuracy = next.accuracy ?? 12;
  const alpha = accuracy <= 8 ? 0.92 : accuracy <= 15 ? 0.78 : 0.6;
  const shouldSmooth = meters <= Math.max(35, accuracy * 3);
  const accepted = shouldSmooth
    ? {
        ...next,
        latitude: previous.latitude + (next.latitude - previous.latitude) * alpha,
        longitude: previous.longitude + (next.longitude - previous.longitude) * alpha,
      }
    : next;
  return { points: [...points, accepted], accepted: true };
}

export function appendTrackPoint(
  points: RecordedTrackPoint[],
  next: RecordedTrackPoint,
  sport: GpsTrackSport = "running",
) {
  return appendTrackPointResult(points, next, sport).points;
}

export function calculateTrackDistance(points: RecordedTrackPoint[]) {
  const distance = points
    .slice(1)
    .reduce(
      (total, point, i) => total + (point.breakBefore ? 0 : haversineKm(points[i]!, point)),
      0,
    );
  return Number.isFinite(distance) && distance > 0 ? distance : 0;
}
