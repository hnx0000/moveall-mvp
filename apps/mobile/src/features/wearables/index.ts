import { Platform } from "react-native";
import { MockWearableAdapter, type WearableAdapter } from "./adapter";
import { NativeHealthAdapter } from "./native-adapter";

export * from "./adapter";

export function createPlatformHealthAdapter(): WearableAdapter {
  if (Platform.OS === "ios") return new NativeHealthAdapter("apple-health");
  if (Platform.OS === "android") return new NativeHealthAdapter("health-connect");
  return new MockWearableAdapter();
}
