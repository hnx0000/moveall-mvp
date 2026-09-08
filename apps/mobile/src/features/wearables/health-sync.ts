import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { api } from "../../api/client";
import type { WearableAdapter } from "./adapter";
import {
  createHealthSyncCoordinator,
  healthOwner,
  type HealthSyncOptions,
  type HealthSyncStatus,
} from "./health-sync-engine";
export type { HealthSyncResult, HealthSyncStatus } from "./health-sync-engine";
export type HealthSyncPhase = HealthSyncStatus["phase"];

let authenticatedUserId: string | null = null;
const coordinator = createHealthSyncCoordinator({
  storage: AsyncStorage,
  api,
  activeUserId: () => authenticatedUserId,
  isForeground: () => Platform.OS !== "web" && AppState.currentState === "active",
});
// Only the auth owner changes this; mounted screens cannot revive a logged-out account.
export const setHealthSyncAccount = (userId: string | null) => {
  if (authenticatedUserId && authenticatedUserId !== userId)
    coordinator.cancel(authenticatedUserId);
  authenticatedUserId = userId;
};
export const isHealthSyncAccount = (userId: string) => authenticatedUserId === userId;
const owner = (userId: string) =>
  healthOwner(userId, Platform.OS === "ios" ? "apple-health" : "health-connect");
export const cancelHealthSync = (userId: string) => coordinator.cancel(userId);
export const getHealthSyncStatus = (userId: string) => coordinator.status(owner(userId));
export const subscribeHealthSyncStatus = (
  listener: (status: HealthSyncStatus) => void,
  userId: string,
) => coordinator.subscribe(owner(userId), listener);
export const markHealthSyncReady = (message = "완료 운동 동기화 준비됨", userId: string) =>
  coordinator.ready(owner(userId), message);
export const setHealthAutoSyncEnabled = (enabled: boolean, userId: string) =>
  coordinator.setEnabled(owner(userId), enabled);
export const isHealthAutoSyncEnabled = (userId: string) => coordinator.isEnabled(owner(userId));
export const syncHealthData = (
  token: string,
  adapter: WearableAdapter,
  options: HealthSyncOptions,
) => coordinator.sync(token, adapter, options);
