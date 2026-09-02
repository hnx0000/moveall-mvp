import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { api } from "../../api/client";
import { useAuth } from "../../auth/auth-context";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
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
  const { session } = useAuth();

  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    let active = true;
    let registeredToken: string | null = null;

    void (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "GROOV 알림",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 180, 120, 180],
          lightColor: "#FF5A36",
        });
      }
      const current = await Notifications.getPermissionsAsync();
      const permission =
        current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted" || !active) return;
      const easProjectId = projectId();
      if (!easProjectId) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
      if (!active) return;
      registeredToken = token;
      await api.registerPushDevice(session.accessToken, {
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        deviceName: Constants.deviceName ?? `GROOV ${Platform.OS}`,
      });
    })().catch(() => undefined);

    return () => {
      active = false;
      if (registeredToken) {
        void api.unregisterPushDevice(session.accessToken, registeredToken).catch(() => undefined);
      }
    };
  }, [session]);

  return null;
}
