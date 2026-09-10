import { useCallback, useState } from "react"; import { uiLayout } from "../../src/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { PostCreateInputSchema } from "@moveall/contracts";
import { useAuth } from "../../src/auth/auth-context";
import { pendingSaves } from "../../src/api/pending-save-runtime";
import type { PendingMutation } from "../../src/api/pending-mutations";
import { useAppTheme } from "../../src/theme-context";

export default function SavedDrafts() {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [items, setItems] = useState<PendingMutation[]>([]);
  const [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setError("");
      if (session)
        void pendingSaves
          .rejectedDrafts(session.user.id)
          .then((value) => {
            if (active) setItems(value);
          })
          .catch(() => {
            if (active) setError("초안을 읽지 못했습니다. 원본은 유지했습니다.");
          });
      return () => {
        active = false;
      };
    }, [session?.user.id]),
  );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, gap: 20 }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={{ color: colors.primary }}>뒤로</Text>
      </Pressable>
      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "700" }}>보관된 게시 초안</Text>
      <Text style={{ color: colors.ink, lineHeight: 24 }}>
        연결할 기록이나 크루가 없어 게시하지 못한 원본입니다. 이 기기의 현재 계정에 보관하며
        자동으로 게시하지 않습니다.
      </Text>
      {!!error && <Text style={{ color: colors.ink }}>{error}</Text>}
      {!error && items.length === 0 && (
        <Text style={{ color: colors.ink }}>보관된 초안이 없습니다.</Text>
      )}
      {items.map((item) => {
        const parsed = PostCreateInputSchema.safeParse(item.input);
        const draft = parsed.success ? parsed.data : null;
        return (
          <View
            key={item.key}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: uiLayout.panelRadius,
              padding: 18,
              gap: 14,
            }}
          >
            <Text style={{ color: colors.ink }}>
              {new Date(item.createdAt).toLocaleString("ko-KR")}
            </Text>
            <Text selectable style={{ color: colors.ink, fontSize: 16, lineHeight: 24 }}>
              {draft?.content ?? "원본 저장 내용"}
            </Text>
            {draft && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: {
                      rejectedDraftKey: item.key,
                    },
                  })
                }
              >
                <Text style={{ color: colors.primary, fontWeight: "700" }}>본문으로 다시 작성</Text>
              </Pressable>
            )}
            <Text style={{ color: colors.ink, lineHeight: 22 }}>
              다시 작성할 때 사진과 연결 기록, 공개 범위를 확인하세요. 아래 첨부 ID·공개 설정을
              포함한 원본은 그대로 보관됩니다.
            </Text>
            <Text selectable style={{ color: colors.ink, fontSize: 13, lineHeight: 20 }}>
              {JSON.stringify(item.input, null, 2)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
