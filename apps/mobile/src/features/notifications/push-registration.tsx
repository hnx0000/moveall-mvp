import { isDemoMode } from "../../config/runtime";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { api } from "../../api/client";
import { useAuth } from "../../auth/auth-context";
import { createPushRegistrationCoordinator, isNotificationIdentity } from "./push-lifecycle";

const coordinator = createPushRegistrationCoordinator(api);
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const recipient = notification.request.content.data?.recipientUserId;
      const allowed = typeof recipient === "string" && isNotificationIdentity(recipient);
      return {
        shouldShowBanner: allowed,
        shouldShowList: allowed,
        shouldPlaySound: allowed,
        shouldSetBadge: allowed,
      };
    },
  });
}
function projectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId
  );
}
export function PushRegistration() {
  const { session, loginLifetime } = useAuth();
  const currentSession = useRef(session);
  currentSession.current = session;
  useEffect(() => {
    if (isDemoMode || !session || Platform.OS === "web") return;
    let active = true;
    const current = () => active && isNotificationIdentity(session.user.id, loginLifetime);
    const job = coordinator.begin({
      isCurrent: current,
      accessToken: () => currentSession.current?.accessToken ?? "",
      prepare: async () => {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "GROOV 알림",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 180, 120, 180],
            lightColor: "#FF5A36",
          });
          if (!current()) return null;
        }
        const permission = await Notifications.getPermissionsAsync();
        if (!current()) return null;
        const granted =
          permission.status === "granted"
            ? permission
            : await Notifications.requestPermissionsAsync();
        if (!current() || granted.status !== "granted") return null;
        const easProjectId = projectId();
        if (!easProjectId) return null;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
        if (!current()) return null;
        return {
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
          deviceName: Constants.deviceName ?? `GROOV ${Platform.OS}`,
        };
      },
    });
    void job.done.catch(() => undefined);
    return () => {
      active = false;
      void job.stop().catch(() => undefined);
    };
  }, [session?.user.id, loginLifetime]);
  return null;
}
