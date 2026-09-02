import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

const taskName = "groov-background-workout-location";
const storageKey = "groov-background-workout-points-v1";

export type BackgroundTrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
};

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(taskName)) {
  TaskManager.defineTask(taskName, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    if (locations.length === 0) return;
    const existing = await readPoints();
    const incoming = locations.map((location): BackgroundTrackPoint => ({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    }));
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify([...existing, ...incoming].slice(-12_000)),
    );
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
  if (Platform.OS !== "web") await AsyncStorage.removeItem(storageKey);
}

export async function consumeBackgroundTrack() {
  if (Platform.OS === "web") return [];
  const points = await readPoints();
  if (points.length > 0) await AsyncStorage.removeItem(storageKey);
  return points;
}

export async function startBackgroundTrack() {
  if (Platform.OS === "web") return false;
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return false;
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) return true;
  await Location.startLocationUpdatesAsync(taskName, {
    accuracy: Location.Accuracy.High,
    activityType: Location.ActivityType.Fitness,
    distanceInterval: 3,
    timeInterval: 2_000,
    deferredUpdatesDistance: 10,
    deferredUpdatesInterval: 5_000,
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

export async function stopBackgroundTrack() {
  if (Platform.OS === "web") return;
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
}
