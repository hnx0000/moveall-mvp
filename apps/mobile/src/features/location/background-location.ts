import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { mergeTrackPointSources, type GpsTrackSport, type RecordedTrackPoint } from "./gps-track";
import { createBackgroundTrackStore, createSerialTaskQueue } from "./tracking-lifecycle";

const taskName = "groov-background-workout-location";
export type BackgroundTrackPoint = RecordedTrackPoint;
const nativeQueue = createSerialTaskQueue();
const buffer = createBackgroundTrackStore<BackgroundTrackPoint>(
  AsyncStorage,
  (existing, incoming, sport) => mergeTrackPointSources(existing, incoming, sport as GpsTrackSport),
);

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(taskName)) {
  TaskManager.defineTask(taskName, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    await buffer.append(
      locations.map((location) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      })),
    );
  });
}

export const clearBackgroundTrack = async () => {
  if (Platform.OS !== "web") await buffer.clear();
};
export const consumeBackgroundTrack = async (isCurrent?: () => boolean) =>
  Platform.OS === "web" ? [] : buffer.consume(isCurrent);
export const readBackgroundTrack = async (checkpointId?: string) =>
  Platform.OS === "web" ? [] : checkpointId ? buffer.readFor(checkpointId) : buffer.read();

export async function startBackgroundTrack(
  sport: GpsTrackSport,
  isCurrent: () => boolean,
  startedAt: number,
  checkpointId?: string,
) {
  if (Platform.OS === "web" || !isCurrent()) return false;
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!isCurrent() || !foreground.granted) return false;
  // Permission prompts must not hold the native stop queue.
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!isCurrent() || !background.granted) return false;
  return nativeQueue(async () => {
    if (!isCurrent()) return false;
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(taskName);
    if (!isCurrent()) return false;
    await buffer.begin(sport, startedAt, checkpointId);
    if (!isCurrent()) return false;
    if (!alreadyStarted)
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
    if (!isCurrent()) {
      if (await Location.hasStartedLocationUpdatesAsync(taskName))
        await Location.stopLocationUpdatesAsync(taskName);
      return false;
    }
    return true;
  });
}
export async function stopBackgroundTrack(cutoff = Date.now()) {
  if (Platform.OS === "web") return;
  // Seal before native shutdown: later fixes must not count as exercise.
  const sealed = buffer.seal(cutoff).then(
    () => ({ error: null as unknown }),
    (error: unknown) => ({ error }),
  );
  return nativeQueue(async () => {
    const result = await sealed;
    if (await Location.hasStartedLocationUpdatesAsync(taskName))
      await Location.stopLocationUpdatesAsync(taskName);
    if (result.error) throw result.error;
  });
}
