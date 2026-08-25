import { type MapPoint } from "../components/workout-map.types";

const DEFAULT_ROUTE_API = "https://valhalla1.openstreetmap.de/route";

export type PlannedRoute = {
  points: MapPoint[];
  distanceKm: number;
  durationSeconds: number;
};

type ValhallaResponse = {
  error?: string;
  trip?: {
    legs?: Array<{ shape?: string }>;
    summary?: { length?: number; time?: number };
  };
};

export async function requestPedestrianRoute(
  start: MapPoint,
  finish: MapPoint,
): Promise<PlannedRoute> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(process.env.EXPO_PUBLIC_ROUTE_API_URL ?? DEFAULT_ROUTE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": "moveall-mvp.chatgpt.site",
      },
      body: JSON.stringify({
        locations: [
          { lat: start.latitude, lon: start.longitude, type: "break" },
          { lat: finish.latitude, lon: finish.longitude, type: "break" },
        ],
        costing: "pedestrian",
        costing_options: {
          pedestrian: {
            walkway_factor: 0.8,
            alley_factor: 2.5,
            driveway_factor: 6,
            step_penalty: 20,
            max_hiking_difficulty: 1,
            use_ferry: 0,
          },
        },
        directions_options: { units: "kilometers", language: "ko-KR", narrative: false },
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as ValhallaResponse;
    if (!response.ok || !payload.trip) {
      throw new Error(payload.error ?? "보행 경로를 계산하지 못했습니다.");
    }
    const shape = payload.trip.legs?.[0]?.shape;
    if (!shape) throw new Error("경로 모양을 받지 못했습니다.");
    const points = decodePolyline6(shape);
    if (points.length < 2) throw new Error("연결 가능한 보행 경로가 없습니다.");
    return {
      points,
      distanceKm: payload.trip.summary?.length ?? 0,
      durationSeconds: payload.trip.summary?.time ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("경로 계산 시간이 초과됐습니다. 다시 시도해 주세요.", {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function decodePolyline6(encoded: string): MapPoint[] {
  const coordinates: MapPoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeResult = decodeValue(encoded, index);
    index = latitudeResult.nextIndex;
    latitude += latitudeResult.delta;

    const longitudeResult = decodeValue(encoded, index);
    index = longitudeResult.nextIndex;
    longitude += longitudeResult.delta;

    coordinates.push({ latitude: latitude / 1_000_000, longitude: longitude / 1_000_000 });
  }

  return coordinates;
}

function decodeValue(encoded: string, startIndex: number) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte: number;

  do {
    if (index >= encoded.length) throw new Error("손상된 경로 데이터입니다.");
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    delta: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}
