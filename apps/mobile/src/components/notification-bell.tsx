import type { UserNotification } from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Bell, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { useAppTheme } from "../theme-context";
import { fonts } from "../theme";

export function NotificationBell() {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const opening = useRef(false);
  const reloadRef = useRef<() => void>(() => {});
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let pending = false;
      setItems([]);
      const reload = async () => {
        if (!session || pending || AppState.currentState === "background") return;
        pending = true;
        setLoading(true);
        try {
          const next = await api.notifications(session.accessToken);
          if (active) {
            setItems(next);
            setError("");
          }
        } catch (caught) {
          if (active)
            setError(caught instanceof Error ? caught.message : "알림을 불러오지 못했습니다.");
        } finally {
          pending = false;
          if (active) setLoading(false);
        }
      };
      reloadRef.current = () => {
        void reload();
      };
      void reload();
      const timer = setInterval(() => void reload(), 15_000);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void reload();
      });
      const pushSubscription =
        Platform.OS !== "web"
          ? Notifications.addNotificationReceivedListener(() => void reload())
          : null;
      return () => {
        active = false;
        clearInterval(timer);
        subscription.remove();
        pushSubscription?.remove();
        reloadRef.current = () => {};
        setOpen(false);
      };
    }, [session]),
  );
  const unread = items.filter((item) => !item.readAt).length;
  async function openItem(item: UserNotification) {
    if (!session || opening.current) return;
    opening.current = true;
    try {
      if (!item.readAt) {
        const updated = await api.markNotificationRead(session.accessToken, item.id);
        setItems((current) => current.map((value) => (value.id === updated.id ? updated : value)));
      }
      setOpen(false);
      if (item.resourceType === "post" && item.resourceId)
        router.push({
          pathname: "/(tabs)/community",
          params: {
            post: item.resourceId,
            comments: item.kind === "comment" || item.kind === "mention" ? "1" : "0",
          },
        });
      else if (item.resourceType === "user" && item.resourceId)
        router.push({
          pathname:
            item.kind === "message" ||
            item.kind === "share" ||
            (item.kind === "system" && item.title.includes("탭톡"))
              ? "/profile/message"
              : "/profile/member",
          params: { userId: item.resourceId },
        });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알림을 열지 못했습니다.");
    } finally {
      opening.current = false;
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`알림 확인, 읽지 않은 알림 ${unread}개`}
        onPress={() => {
          setOpen(true);
          reloadRef.current();
        }}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Bell color={unread ? colors.primary : colors.ink} size={22} />
        {unread ? (
          <View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              backgroundColor: colors.primary,
              borderRadius: 10,
              minWidth: 18,
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: "white", fontSize: 10, textAlign: "center" }}>
              {unread > 99 ? "99+" : unread}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            padding: 20,
            backgroundColor: "rgba(0,0,0,.75)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 448,
              maxHeight: "85%",
              backgroundColor: colors.surface,
              borderRadius: 22,
              padding: 20,
              gap: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.ink }}>
                알림 {unread ? `· ${unread}` : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="알림 닫기"
                onPress={() => setOpen(false)}
              >
                <X color={colors.ink} size={24} />
              </Pressable>
            </View>
            {!session ? (
              <Text style={{ color: colors.muted }}>로그인 후 알림을 확인할 수 있습니다.</Text>
            ) : null}
            {loading && !items.length ? <ActivityIndicator color={colors.primary} /> : null}
            {error ? (
              <Pressable onPress={() => reloadRef.current()}>
                <Text style={{ color: colors.danger }}>{error} · 다시 시도</Text>
              </Pressable>
            ) : null}
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => void openItem(item)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: item.readAt ? colors.surface : colors.surfaceMuted,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.ink, fontFamily: fonts.bold }}>
                    {item.readAt ? "" : "● "}
                    {item.title}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.body}</Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {new Date(item.createdAt).toLocaleString("ko-KR")}
                  </Text>
                </Pressable>
              ))}
              {session && !loading && !error && !items.length ? (
                <Text style={{ color: colors.muted }}>새 알림이 없습니다.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
