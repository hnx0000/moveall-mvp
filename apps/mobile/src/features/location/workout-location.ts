import * as Location from "expo-location";
import { AppState, Platform } from "react-native";
import {
  createResilientWatch,
  subscribeBrowserLocation,
  type LocationWatchError,
} from "./resilient-watch";

export async function previewWorkoutLocation(): Promise<Location.LocationObject | null> {
  if (Platform.OS !== "web") {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted || !(await Location.hasServicesEnabledAsync())) return null;
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  }
  if (!globalThis.isSecureContext || !navigator.geolocation) return null;
  // Passive preview must not prompt on every visit; recording itself works without Permissions API.
  if (!navigator.permissions?.query) return null;
  const permission = await navigator.permissions.query({ name: "geolocation" });
  if (permission.state !== "granted") return null;
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (point) =>
        resolve({
          timestamp: point.timestamp,
          coords: {
            latitude: point.coords.latitude,
            longitude: point.coords.longitude,
            accuracy: point.coords.accuracy,
            altitude: point.coords.altitude,
            altitudeAccuracy: point.coords.altitudeAccuracy,
            heading: point.coords.heading,
            speed: point.coords.speed,
          },
        }),
      reject,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    ),
  );
}

/** Browser and native tracking share lifecycle, not permission or accuracy option formats. */
export function watchWorkoutLocation(
  onPosition: (point: Location.LocationObject) => void,
  onError: (error: LocationWatchError) => void,
  onWaiting: () => void,
) {
  const web = Platform.OS === "web";
  const watch = createResilientWatch<Location.LocationObject>({
    onPosition,
    onError,
    onWaiting,
    isVisible: () =>
      web
        ? typeof document !== "undefined" && document.visibilityState !== "hidden"
        : AppState.currentState === "active",
    subscribe: (position, error) => {
      if (web) {
        if (
          typeof navigator === "undefined" ||
          !navigator.geolocation ||
          !globalThis.isSecureContext
        ) {
          throw {
            code: 1,
            message: "GPS 기록은 위치 권한이 허용된 HTTPS 주소에서 사용할 수 있습니다.",
          };
        }
        return subscribeBrowserLocation(
          navigator.geolocation,
          (point) =>
            position({
              timestamp: point.timestamp,
              coords: {
                latitude: point.coords.latitude,
                longitude: point.coords.longitude,
                accuracy: point.coords.accuracy,
                altitude: point.coords.altitude,
                altitudeAccuracy: point.coords.altitudeAccuracy,
                heading: point.coords.heading,
                speed: point.coords.speed,
              },
            }),
          error,
        );
      }
      return Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1_000,
          distanceInterval: 1,
        },
        position,
        (message) => error({ message }),
      );
    },
  });
  const resume = () => {
    if (web && document.visibilityState === "hidden") return;
    watch.resume();
  };
  const state = !web
    ? AppState.addEventListener("change", (value) => {
        if (value === "active") resume();
      })
    : null;
  if (web) document.addEventListener("visibilitychange", resume);
  return {
    remove() {
      watch.remove();
      state?.remove();
      if (web) document.removeEventListener("visibilitychange", resume);
    },
  };
}

/** Prevent automatic screen sleep where supported; manual locking can still suspend web GPS. */
export function keepWorkoutScreenAwake(onUnavailable: () => void) {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => {};
  let closed = false,
    pending = false;
  let lock: WakeLockSentinel | undefined;
  const acquire = async () => {
    if (closed || pending || lock || document.visibilityState === "hidden") return;
    if (!navigator.wakeLock) {
      onUnavailable();
      return;
    }
    pending = true;
    try {
      const next = await navigator.wakeLock.request("screen");
      if (closed) {
        await next.release();
        return;
      }
      lock = next;
      next.addEventListener("release", () => {
        if (lock === next) lock = undefined;
      });
    } catch {
      if (!closed) onUnavailable();
    } finally {
      pending = false;
    }
  };
  void acquire();
  document.addEventListener("visibilitychange", acquire);
  return () => {
    closed = true;
    document.removeEventListener("visibilitychange", acquire);
    void lock?.release().catch(() => undefined);
  };
}
