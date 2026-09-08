import { isDemoMode } from "../../config/runtime";
import { useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../../auth/auth-context";
import { createPlatformHealthAdapter } from ".";
import { cancelHealthSync, syncHealthData } from "./health-sync";

export function HealthAutoSync() {
  const { session } = useAuth();
  const adapter = useMemo(() => createPlatformHealthAdapter(), []);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const userId = session?.user.id;

  useEffect(() => {
    if (isDemoMode || !userId || Platform.OS === "web") return;
    let active = true;
    const sync = () => {
      const current = sessionRef.current;
      if (!current || current.user.id !== userId) return;
      void syncHealthData(current.accessToken, adapter, {
        userId,
        isCurrent: () => active && sessionRef.current?.user.id === userId,
        getAccessToken: () => sessionRef.current?.accessToken ?? "",
      }).catch(() => undefined);
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      active = false;
      subscription.remove();
      cancelHealthSync(userId);
    };
  }, [adapter, userId]);

  return null;
}
