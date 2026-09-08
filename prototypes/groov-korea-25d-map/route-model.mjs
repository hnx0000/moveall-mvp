const EARTH_RADIUS_METERS = 6371008.8;
const radians = (degrees) => degrees * Math.PI / 180;

export function distanceMeters(a, b) {
  const phiA = radians(a[1]);
  const phiB = radians(b[1]);
  const deltaPhi = phiB - phiA;
  const deltaLambda = radians(b[0] - a[0]);
  const h = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phiA) * Math.cos(phiB) * Math.sin(deltaLambda / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function routeLengthMeters(coordinates) {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(coordinates[index], point), 0);
}

export function routeBearing(a, b) {
  const phiA = radians(a[1]);
  const phiB = radians(b[1]);
  const deltaLambda = radians(b[0] - a[0]);
  const y = Math.sin(deltaLambda) * Math.cos(phiB);
  const x = Math.cos(phiA) * Math.sin(phiB) - Math.sin(phiA) * Math.cos(phiB) * Math.cos(deltaLambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Distance-based playback follows source road vertices instead of cutting corners. */
export function sampleRoute(coordinates, requestedDistanceMeters) {
  if (!coordinates.length) return { coordinate: null, bearing: 0, completedCoordinates: [], distanceMeters: 0, progress: 0 };
  const total = routeLengthMeters(coordinates);
  const target = Math.min(total, Math.max(0, Number(requestedDistanceMeters) || 0));
  const completed = [coordinates[0].slice()];
  let travelled = 0;
  let bearing = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const next = coordinates[index];
    const segment = distanceMeters(previous, next);
    if (!segment) continue;
    bearing = routeBearing(previous, next);
    if (travelled + segment >= target) {
      const fraction = (target - travelled) / segment;
      const coordinate = [previous[0] + (next[0] - previous[0]) * fraction, previous[1] + (next[1] - previous[1]) * fraction];
      if (fraction > 0) completed.push(coordinate);
      return { coordinate, bearing, completedCoordinates: completed, distanceMeters: target, progress: total ? target / total : 1 };
    }
    travelled += segment;
    completed.push(next.slice());
  }
  return { coordinate: coordinates.at(-1).slice(), bearing, completedCoordinates: completed, distanceMeters: target, progress: 1 };
}

/** Foreground browser GPS only. A signal gap starts a new segment; missing travel is never fabricated. */
export function filterGpsFix(previousFix, newFix, options = {}) {
  const settings = { maxAccuracy: 45, maxSpeedMps: 8, maxJumpMeters: 150, maxGapMs: 15000, maxAgeMs: 10000, minMovementMeters: 2, ...options };
  const reject = (reason) => ({ accepted: false, reason, fix: newFix, breakSegment: false, distanceMeters: 0 });
  const { longitude, latitude, accuracy, timestamp } = newFix || {};
  if (![longitude, latitude, accuracy, timestamp].every(Number.isFinite) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90 || accuracy < 0 || timestamp < 0) return reject('invalid');
  if (accuracy > settings.maxAccuracy) return reject('accuracy');
  if (Number.isFinite(settings.now) && settings.now - timestamp > settings.maxAgeMs) return reject('stale');
  const coordinate = [longitude, latitude];
  if (!previousFix) return { accepted: true, reason: 'first-fix', coordinate, fix: newFix, breakSegment: false, distanceMeters: 0, speedMps: 0 };
  const elapsedMs = timestamp - previousFix.timestamp;
  if (elapsedMs <= 0) return reject('out-of-order');
  const travelled = distanceMeters([previousFix.longitude, previousFix.latitude], coordinate);
  const speedMps = travelled / (elapsedMs / 1000);
  if (speedMps > settings.maxSpeedMps) return reject('speed');
  const breakSegment = elapsedMs > settings.maxGapMs;
  if (!breakSegment && travelled > settings.maxJumpMeters) return reject('jump');
  const jitterFloor = Math.max(settings.minMovementMeters, Math.min(4, Math.min(accuracy, previousFix.accuracy || accuracy) * 0.12));
  if (!breakSegment && travelled < jitterFloor) return reject('stationary');
  return { accepted: true, reason: breakSegment ? 'signal-recovered' : 'tracking', coordinate, fix: newFix, breakSegment, distanceMeters: breakSegment ? 0 : travelled, speedMps };
}
