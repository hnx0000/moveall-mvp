import { useEffect, useMemo } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../../auth/auth-context";
import { createPlatformHealthAdapter } from ".";
import { syncHealthData } from "./health-sync";

export function HealthAutoSync() {
  const { session } = useAuth();
  const adapter = useMemo(() => createPlatformHealthAdapter(), []);

  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    const sync = () => void syncHealthData(session.accessToken, adapter).catch(() => undefined);
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, [adapter, session]);

  return null;
}
