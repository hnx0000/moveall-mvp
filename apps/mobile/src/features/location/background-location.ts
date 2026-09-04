import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { appendTrackPoint, type GpsTrackSport, type RecordedTrackPoint } from "./gps-track";

const taskName = "groov-background-workout-location";
const storageKey = "groov-background-workout-points-v1";
const sportKey = "groov-background-workout-sport-v1";
let backgroundWriteQueue = Promise.resolve();

export type BackgroundTrackPoint = RecordedTrackPoint;

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(taskName)) {
  TaskManager.defineTask(taskName, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    if (locations.length === 0) return;
    const incoming = locations.map((location): BackgroundTrackPoint => ({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    }));
    // Serialize read-modify-write cycles so concurrent native batches cannot overwrite each other.
    backgroundWriteQueue = backgroundWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const existing = await readPoints();
        const storedSport = await AsyncStorage.getItem(sportKey);
        const sport = isGpsTrackSport(storedSport) ? storedSport : "running";
        const filtered = incoming.reduce(
          (points, point) => appendTrackPoint(points, point, sport),
          existing,
        );
        await AsyncStorage.setItem(storageKey, JSON.stringify(filtered.slice(-30_000)));
      });
    await backgroundWriteQueue;
  });
}

async function readPoints(): Promise<BackgroundTrackPoint[]> {
  try {
    const value = await AsyncStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as BackgroundTrackPoint[]) : [];
  } catch {
    return [];
  }
}

export async function clearBackgroundTrack() {
  if (Platform.OS !== "web") {
    await backgroundWriteQueue.catch(() => undefined);
    await AsyncStorage.multiRemove([storageKey, sportKey]);
  }
}

export async function consumeBackgroundTrack() {
  if (Platform.OS === "web") return [];
  await backgroundWriteQueue.catch(() => undefined);
  const points = await readPoints();
  if (points.length > 0) await AsyncStorage.removeItem(storageKey);
  return points;
}

/** Non-destructive while the background task is still writing. Duplicate fixes are filtered on merge. */
export async function readBackgroundTrack() {
  if (Platform.OS === "web") return [];
  await backgroundWriteQueue.catch(() => undefined);
  return readPoints();
}

export async function startBackgroundTrack(sport: GpsTrackSport) {
  if (Platform.OS === "web") return false;
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return false;
  await AsyncStorage.setItem(sportKey, sport);
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) return true;
  await Location.startLocationUpdatesAsync(taskName, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    distanceInterval: 2,
    timeInterval: 1_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "GROOV 운동 기록 중",
      notificationBody: "백그라운드에서도 이동 거리와 경로를 기록하고 있습니다.",
      notificationColor: "#FF5A36",
    },
  });
  return true;
}

function isGpsTrackSport(value: string | null): value is GpsTrackSport {
  return ["running", "hiking", "cycling", "swimming", "strength", "diving"].includes(value ?? "");
}

export async function stopBackgroundTrack() {
  if (Platform.OS === "web") return;
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
}
