import type { SafetySummary } from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Screen } from "../../src/components/ui";
import { useAppTheme } from "../../src/theme-context";

export default function PrivacyScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [value, setValue] = useState<SafetySummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const load = useCallback(async () => {
    if (session) setValue(await api.safetySummary(session.accessToken));
  }, [session]);
  useFocusEffect(
    useCallback(() => {
      void load().catch((e: Error) => setError(e.message));
    }, [load]),
  );
  async function change(action: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen title="공개 범위 · 차단 · 제한">
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.primary }}>← 뒤로</Text>
      </Pressable>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {!value ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={{ color: colors.muted }}>
            목록 비공개는 제한과 별개로 설정할 수 있습니다. 제한해도 팔로우는 유지되며 상대방에게
            알림을 보내지 않습니다. 제한된 상대방에게는 내 기록·게시물·메달·관계 목록이 공개되지
            않습니다.
          </Text>
          {(["hideFollowers", "hideFollowing"] as const).map((key) => (
            <View
              key={key}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.ink }}>
                {key === "hideFollowers" ? "팔로워 목록 비공개" : "팔로잉 목록 비공개"}
              </Text>
              <Switch
                disabled={busy}
                value={value[key]}
                onValueChange={(next) => {
                  if (session)
                    void change(() =>
                      api.saveSocialPrivacy(session.accessToken, {
                        hideFollowers: value.hideFollowers,
                        hideFollowing: value.hideFollowing,
                        [key]: next,
                      }),
                    );
                }}
              />
            </View>
          ))}
          {(["blocked", "restricted"] as const).map((kind) => (
            <View key={kind} style={{ gap: 14 }}>
              <Text style={{ color: colors.ink, fontSize: 20 }}>
                {kind === "blocked" ? "차단 목록" : "제한 목록"} · {value[kind].length}
              </Text>
              {!value[kind].length ? (
                <Text style={{ color: colors.muted }}>등록된 계정이 없습니다.</Text>
              ) : (
                value[kind].map((person) => (
                  <View
                    key={person.id}
                    style={{ flexDirection: "row", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: colors.ink }}>{person.displayName}</Text>
                    <Pressable
                      disabled={busy}
                      onPress={() => {
                        if (session)
                          void change(() =>
                            kind === "blocked"
                              ? api.unblockUser(session.accessToken, person.id)
                              : api.restrictUser(session.accessToken, person.id, false),
                          );
                      }}
                    >
                      <Text style={{ color: colors.primary }}>해제</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          ))}
          <Text style={{ color: colors.muted }}>
            차단을 해제해도 기존 팔로우 관계가 자동 복원되지는 않습니다.
          </Text>
        </>
      )}
    </Screen>
  );
}
