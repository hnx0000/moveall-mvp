export type MapCourse = {
  name: string;
  sport: "running" | "cycling" | "hiking";
  coordinates: number[][];
  pins: number[][];
  distanceMeters: number;
  turnaroundIndex: number | null;
  id?: string;
};
export function readCourse(input: unknown): MapCourse {
  if (!input || typeof input !== "object") throw new Error("코스 데이터가 올바르지 않습니다.");
  const c = input as Record<string, unknown>;
  const coordinate = (p: unknown): p is number[] =>
    Array.isArray(p) &&
    p.length >= 2 &&
    p.length <= 3 &&
    p.every(Number.isFinite) &&
    p[0] >= 124 &&
    p[0] <= 132.5 &&
    p[1] >= 32.8 &&
    p[1] <= 39;
  if (
    typeof c.name !== "string" ||
    !c.name.trim() ||
    c.name.length > 60 ||
    !["running", "cycling", "hiking"].includes(String(c.sport)) ||
    !Array.isArray(c.coordinates) ||
    c.coordinates.length < 2 ||
    c.coordinates.length > 50000 ||
    !c.coordinates.every(coordinate) ||
    !Array.isArray(c.pins) ||
    c.pins.length < 2 ||
    c.pins.length > 30 ||
    !c.pins.every(coordinate) ||
    typeof c.distanceMeters !== "number" ||
    !Number.isFinite(c.distanceMeters) ||
    c.distanceMeters < 8 ||
    c.distanceMeters > 500000 ||
    (c.turnaroundIndex != null &&
      (!Number.isInteger(c.turnaroundIndex) ||
        Number(c.turnaroundIndex) < 1 ||
        Number(c.turnaroundIndex) >= c.pins.length))
  ) {
    throw new Error("코스 이름·핀·경로를 확인해주세요.");
  }
  return {
    name: c.name.trim(),
    sport: c.sport as MapCourse["sport"],
    coordinates: c.coordinates,
    pins: c.pins,
    distanceMeters: c.distanceMeters,
    turnaroundIndex: c.turnaroundIndex == null ? null : Number(c.turnaroundIndex),
    ...(typeof c.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(c.id) ? { id: c.id } : {}),
  };
}
export const courseStorageKey = (userId: string) =>
  `groov:courses:v1:${encodeURIComponent(userId)}`;
export function acceptsMapMessage(
  message: unknown,
  channel: string,
): message is { source: string; channel: string; type: string; payload: Record<string, unknown> } {
  if (!message || typeof message !== "object") return false;
  const m = message as Record<string, unknown>;
  return (
    m.source === "groov-map" &&
    m.channel === channel &&
    typeof m.type === "string" &&
    !!m.payload &&
    typeof m.payload === "object"
  );
}
