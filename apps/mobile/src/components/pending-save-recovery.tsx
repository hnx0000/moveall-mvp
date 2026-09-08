import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, Text, View } from "react-native";
import { PostCreateInputSchema, WorkoutSessionCreateInputSchema } from "@moveall/contracts";
import { api, ApiError } from "../api/client";
import { pendingSaves, subscribePendingSaves } from "../api/pending-save-runtime";
import type { PendingMutation } from "../api/pending-mutations";
import { useAuth } from "../auth/auth-context";
import { isNotificationIdentity } from "../features/notifications/push-lifecycle";
import { isDemoMode } from "../config/runtime";
import { useAppTheme } from "../theme-context";
import { activeWorkouts } from "../features/location/active-workout-runtime";
import { useRouter } from "expo-router";

export function PendingSaveRecovery() {
  const router = useRouter();
  const { session, loginLifetime, restoring } = useAuth();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<PendingMutation[]>([]);
  const [message, setMessage] = useState("");
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const jobGeneration = useRef(0);
  useEffect(() => {
    jobGeneration.current++;
    flight.current = false;
    setBusy(false);
    setItems([]);
    setMessage("");
    setHidden(false);
    if (!session || restoring || isDemoMode) return;
    let active = true;
    const refresh = () => {
      void pendingSaves
        .list(session.user.id)
        .then((next) => {
          if (active && isNotificationIdentity(session.user.id, loginLifetime)) {
            setItems(next);
            setHidden(false);
          }
        })
        .catch(() => {
          if (active) setMessage("임시 저장 내용을 읽지 못했습니다. 원본은 유지했습니다.");
        });
    };
    refresh();
    const unsub = subscribePendingSaves(refresh);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      unsub();
      appState.remove();
    };
  }, [session?.user.id, loginLifetime, restoring]);
  const recover = async () => {
    const item = items[0];
    if (!session || !item || item.owner !== session.user.id || flight.current) return;
    const job = ++jobGeneration.current;
    flight.current = true;
    setBusy(true);
    setMessage("");
    const current = () =>
      job === jobGeneration.current && isNotificationIdentity(session.user.id, loginLifetime);
    try {
      if (item.kind === "post.create")
        await api.createPost(
          session.accessToken,
          PostCreateInputSchema.parse(item.input),
          undefined,
          { idempotencyKey: item.key },
        );
      else
        await api.createWorkoutSession(
          session.accessToken,
          WorkoutSessionCreateInputSchema.parse(item.input),
          { idempotencyKey: item.key },
        );
      if (!current()) return;
      const next = await pendingSaves.list(item.owner);
      if (!current()) return;
      setItems(next);
      setMessage(
        "저장 결과를 확인했습니다. 같은 기록을 중복 생성하지 않았습니다. 기록 또는 피드를 새로 열어 확인해 주세요.",
      );
    } catch (error) {
      if (!current()) return;
      if (
        error instanceof ApiError &&
        ["SAVED_RESOURCE_DELETED", "POST_INPUT_NOT_CREATED"].includes(error.code)
      ) {
        if (item.kind === "workout.create") await activeWorkouts.complete(item.owner, item.key);
        if (error.code === "SAVED_RESOURCE_DELETED")
          await pendingSaves.acknowledge(item.owner, item.kind, item.key);
        if (!current()) return;
        const next = await pendingSaves.list(item.owner);
        if (!current()) return;
        setItems(next);
        setMessage(
          error.code === "POST_INPUT_NOT_CREATED"
            ? "게시물이 생성되지 않았음을 확인했습니다. 본문·첨부·공개 설정은 보관된 게시 초안에 남겼습니다. 연결할 기록이나 크루를 다시 선택해 주세요."
            : "이미 삭제한 기록입니다. 다시 만들지 않고 임시 요청만 정리했습니다.",
        );
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : "저장 결과를 확인하지 못했습니다. 요청을 보존했습니다.",
        );
    } finally {
      if (current()) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!session && !hidden && (items.length > 0 || !!message)}
      onRequestClose={() => {
        if (!busy) setHidden(true);
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.82)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            padding: 24,
            borderRadius: 24,
            gap: 18,
            maxWidth: 480,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "700" }}>
            이전 저장 결과 확인
          </Text>
          <Text style={{ color: colors.ink, lineHeight: 23 }}>
            {message ||
              "응답을 확인하지 못한 저장 요청이 있습니다. 확인을 누르면 같은 요청으로 저장 여부를 확인합니다. 자동으로 게시하지 않습니다."}
          </Text>
          {items.length > 0 && (
            <Pressable
              disabled={busy}
              onPress={() => void recover()}
              accessibilityRole="button"
              style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 14 }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                {busy ? "확인 중…" : "저장 결과 확인"}
              </Text>
            </Pressable>
          )}
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            onPress={() => {
              setHidden(true);
              router.push("/profile/saved-drafts");
            }}
            style={{ padding: 12 }}
          >
            <Text style={{ color: colors.primary, textAlign: "center" }}>보관된 게시 초안</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            onPress={() => setHidden(true)}
            style={{ padding: 12 }}
          >
            <Text style={{ color: colors.ink, textAlign: "center" }}>
              {items.length ? "나중에 확인" : "확인"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
