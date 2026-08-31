import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type NeighborhoodPreferences = {
  neighborhood: string;
  title: string;
  verifiedAt: string;
};

const storageKey = "groov-neighborhood-preferences-v1";
export const neighborhoodVerificationDays = 30;

export function neighborhoodVerificationExpiresAt(verifiedAt: string) {
  return new Date(Date.parse(verifiedAt) + neighborhoodVerificationDays * 24 * 60 * 60 * 1000);
}

export function neighborhoodVerificationDaysRemaining(verifiedAt: string, now = new Date()) {
  const remainingMs = neighborhoodVerificationExpiresAt(verifiedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function isNeighborhoodVerificationValid(verifiedAt: string, now = new Date()) {
  return neighborhoodVerificationExpiresAt(verifiedAt).getTime() > now.getTime();
}

export async function readNeighborhoodPreferences(): Promise<NeighborhoodPreferences | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(storageKey)
        : await SecureStore.getItemAsync(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isNeighborhoodPreferences(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveNeighborhoodPreferences(value: NeighborhoodPreferences) {
  try {
    const serialized = JSON.stringify(value);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(storageKey, serialized);
      return;
    }
    await SecureStore.setItemAsync(storageKey, serialized);
  } catch {
    // The league remains usable for the current session even when device storage is unavailable.
  }
}

function isNeighborhoodPreferences(value: unknown): value is NeighborhoodPreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NeighborhoodPreferences>;
  return (
    typeof candidate.neighborhood === "string" &&
    candidate.neighborhood.length > 0 &&
    typeof candidate.title === "string" &&
    candidate.title.length > 0 &&
    typeof candidate.verifiedAt === "string" &&
    Number.isFinite(Date.parse(candidate.verifiedAt))
  );
}
