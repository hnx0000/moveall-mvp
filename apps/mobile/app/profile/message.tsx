import type { DirectMessage } from "@moveall/contracts";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { useAppTheme } from "../../src/theme-context";

export default function MessagePage() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!session || !userId) return;
    try {
      setMessages(await api.messages(session.accessToken, userId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "탭톡을 불러오지 못했습니다.");
    }
  }, [session, userId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const send = async () => {
    if (!session || !userId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await api.sendMessage(session.accessToken, userId, { content: draft.trim() });
      setMessages((current) => [...current, message]);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "탭톡을 보내지 못했습니다.");
    } finally {
      setSending(false);
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.page}>
          <View style={styles.top}>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.back, { color: colors.muted }]}>← BACK</Text>
            </Pressable>
            <View>
              <Text style={[styles.name, { color: colors.ink }]}>{name ?? "MOVE 멤버"}</Text>
              <Text style={[styles.status, { color: colors.primary }]}>TAP TALK</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.messages}>
            {messages.map((message) => {
              const mine = message.senderId === session?.user.id;
              return (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    mine
                      ? styles.mine
                      : { backgroundColor: colors.surfaceMuted, alignSelf: "flex-start" },
                  ]}
                >
                  <Text style={[styles.messageText, { color: mine ? "#FFFFFF" : colors.ink }]}>
                    {message.content}
                  </Text>
                  <Text
                    style={[styles.time, { color: mine ? "rgba(255,255,255,0.72)" : colors.muted }]}
                  >
                    {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            })}
            {messages.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>첫 탭톡을 보내보세요.</Text>
            ) : null}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={[styles.composer, { borderColor: colors.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void send()}
              placeholder="탭톡 입력"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.ink }]}
            />
            <Pressable
              disabled={sending || !draft.trim()}
              onPress={() => void send()}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendText}>보내기</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    safe: { flex: 1 },
    flex: { flex: 1 },
    page: { flex: 1, width: "100%", maxWidth: 448, alignSelf: "center", padding: 20, gap: 12 },
    top: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 14,
    },
    back: { fontSize: 9, fontWeight: "900" },
    name: { fontSize: 15, fontWeight: "900", textAlign: "right" },
    status: { fontSize: 6, fontWeight: "900", marginTop: 2, textAlign: "right" },
    messages: { paddingVertical: 14, gap: 8 },
    bubble: { maxWidth: "78%", padding: 12, borderRadius: 12, gap: 4 },
    mine: { alignSelf: "flex-end", backgroundColor: colors.primary },
    messageText: { fontSize: 11, lineHeight: 17 },
    time: { fontSize: 6 },
    empty: { textAlign: "center", paddingVertical: 70, fontSize: 10 },
    composer: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12, gap: 8 },
    input: { flex: 1, minHeight: 44, fontSize: 11 },
    send: { minWidth: 74, borderRadius: 7, alignItems: "center", justifyContent: "center" },
    sendText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
    error: { color: colors.primary, fontSize: 9 },
  });
}
