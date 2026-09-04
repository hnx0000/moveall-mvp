import type { MapPoint } from "./workout-map.types";

export function splitRouteSegments(points: MapPoint[]) {
  return points.reduce<MapPoint[][]>((segments, point) => {
    if (segments.length === 0 || point.breakBefore) segments.push([]);
    segments.at(-1)!.push(point);
    return segments;
  }, []);
}

export function mapFitPoints(points: MapPoint[], plannedPoints: MapPoint[], places: MapPoint[]) {
  if (points.length > 1) return points;
  if (plannedPoints.length > 1) return plannedPoints;
  return places;
}
