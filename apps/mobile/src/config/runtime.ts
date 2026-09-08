import { resolveAppMode, sessionStorageKey } from "./app-mode";
export const appMode = resolveAppMode(process.env.EXPO_PUBLIC_APP_MODE);
export const isDemoMode = appMode === "demo";
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const authStorageKey = sessionStorageKey(appMode, apiBaseUrl);
