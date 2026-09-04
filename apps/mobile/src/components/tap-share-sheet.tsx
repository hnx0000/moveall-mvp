import {
  sportLabels,
  type FeedPost,
  type PostShareResult,
  type PublicUser,
} from "@moveall/contracts";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Check, Link2, Search, Share2, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { demoAvatarSources } from "../demo-avatars";
import { fonts, radius, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";
import { TapTalkIcon } from "./tap-icons";

export function TapShareSheet({
  post,
  onClose,
  onShared,
  onNotice,
}: {
  post: FeedPost;
  onClose: () => void;
  onShared: (result: PostShareResult) => void;
  onNotice: (message: string) => void;
}) {
  const { session } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [sentTo, setSentTo] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "external" | "copy" | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      setError("로그인 후 탭톡으로 공유할 수 있습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summary = await api.socialSuggestions(session.accessToken);
      if (!mounted.current) return;
      const next = summary.people.filter((person) => person.id !== session.user.id);
      setPeople(next);
      setSelected((current) => current.filter((id) => next.some((person) => person.id === id)));
    } catch (caught) {
      if (mounted.current)
        setError(caught instanceof Error ? caught.message : "팔로잉을 불러오지 못했습니다.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [session]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const close = () => {
    if (!busyRef.current) onClose();
  };
  const begin = (action: NonNullable<typeof busy>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(action);
    setError(null);
    return true;
  };
  const finish = () => {
    busyRef.current = false;
    if (mounted.current) setBusy(null);
  };
  const send = async () => {
    if (!session || !selected.length || !begin("send")) return;
    try {
      const result = await api.sharePost(session.accessToken, post.id, selected);
      onShared(result);
      setSentTo([...selected]);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "전송하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      finish();
    }
  };
  const external = async (copy: boolean) => {
    if (!begin(copy ? "copy" : "external")) return;
    const url = `https://groov.longrun0000.chatgpt.site/?post=${encodeURIComponent(post.id)}`;
    try {
      if (copy) {
        await Clipboard.setStringAsync(url);
        onClose();
        onNotice("게시물 링크를 복사했습니다.");
      } else {
        const result = await Share.share({
          title: `${post.authorDisplayName}님의 GROOV 피드`,
          message: `${post.content}\n\n${url}`,
          url,
        });
        if (result.action !== Share.dismissedAction) onClose();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "공유창을 열지 못했습니다.");
    } finally {
      finish();
    }
  };
  const visiblePeople = people.filter((person) =>
    person.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  if (sentTo)
    return (
      <Modal animationType="fade" transparent visible onRequestClose={close}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.card}>
            <Text style={styles.title}>탭톡에 공유했어요</Text>
            <Text style={styles.hint}>
              대화를 열어 이야기를 이어가세요. 이미 공유한 게시물은 중복 전송되지 않습니다.
            </Text>
            {people
              .filter((person) => sentTo.includes(person.id))
              .map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  style={styles.preview}
                  onPress={() => {
                    onClose();
                    router.push({
                      pathname: "/profile/message",
                      params: { userId: person.id, name: person.displayName },
                    });
                  }}
                >
                  <Text style={styles.previewName}>{person.displayName} · 탭톡 열기 →</Text>
                </Pressable>
              ))}
            <Pressable accessibilityRole="button" style={styles.send} onPress={close}>
              <Text style={styles.sendText}>피드 계속 보기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  return (
    <Modal animationType="fade" transparent visible onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <TapTalkIcon color={colors.primary} size={27} />
              <View>
                <Text style={styles.eyebrow}>TAP TALK</Text>
                <Text style={styles.title}>탭톡으로 공유</Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel="공유 닫기"
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={close}
              style={styles.close}
            >
              <X size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.preview}>
            <Text style={styles.previewName}>
              {post.authorDisplayName} · {sportLabels[post.sport]}
            </Text>
            <Text numberOfLines={2} style={styles.previewText}>
              {post.content}
            </Text>
          </View>
          <Text style={styles.hint}>받을 사람을 선택하세요. 각자의 대화로 전송됩니다.</Text>
          <View style={styles.search}>
            <Search color={colors.muted} size={18} />
            <TextInput
              accessibilityLabel="공유할 팔로잉 검색"
              editable={busy === null}
              autoCapitalize="none"
              placeholder="팔로잉 검색"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              style={styles.input}
            />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.peopleScroll}
            contentContainerStyle={styles.people}
          >
            {loading ? (
              <ActivityIndicator
                accessibilityLabel="팔로잉 불러오는 중"
                color={colors.primary}
                style={styles.empty}
              />
            ) : (
              visiblePeople.map((person) => {
                const checked = selected.includes(person.id);
                const source = person.avatarDataUri
                  ? { uri: person.avatarDataUri }
                  : demoAvatarSources[person.id];
                return (
                  <View key={person.id} style={styles.personSlot}>
                    <Pressable
                      accessibilityLabel={person.displayName}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked, disabled: busy !== null }}
                      disabled={busy !== null}
                      onPress={() => {
                        if (!checked && selected.length >= 50) {
                          setError("한 번에 최대 50명까지 선택할 수 있습니다.");
                          return;
                        }
                        setSelected((current) =>
                          checked
                            ? current.filter((id) => id !== person.id)
                            : [...current, person.id],
                        );
                      }}
                      style={styles.person}
                    >
                      <View style={[styles.avatar, checked && styles.avatarSelected]}>
                        {source ? (
                          <Image source={source} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.initial}>{person.displayName.slice(0, 1)}</Text>
                        )}
                        {checked ? (
                          <View style={styles.check}>
                            <Check color="#FFFFFF" size={12} strokeWidth={3} />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.personName, checked && styles.selectedName]}
                      >
                        {person.displayName}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
            {!loading && !visiblePeople.length ? (
              <Text style={styles.empty}>
                {people.length
                  ? "검색 결과가 없습니다."
                  : "아직 팔로잉이 없습니다.\n친구를 팔로우한 뒤 피드를 보내보세요."}
              </Text>
            ) : null}
          </ScrollView>
          {error ? (
            <View style={styles.errorRow}>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <Pressable disabled={busy !== null} onPress={() => void load()}>
                <Text style={styles.retry}>목록 새로고침</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${selected.length}명에게 피드 보내기`}
            disabled={!selected.length || busy !== null || loading}
            onPress={() => void send()}
            style={[styles.send, (!selected.length || busy !== null || loading) && styles.disabled]}
          >
            {busy === "send" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>
                {selected.length ? `${selected.length}명에게 보내기` : "보낼 사람 선택"}
              </Text>
            )}
          </Pressable>
          <View style={styles.externalRow}>
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => void external(false)}
              style={styles.external}
            >
              <Share2 size={18} color={colors.muted} />
              <Text style={styles.externalText}>외부 앱 공유</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => void external(true)}
              style={styles.external}
            >
              <Link2 size={18} color={colors.muted} />
              <Text style={styles.externalText}>링크 복사</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      padding: 16,
      backgroundColor: "rgba(0,0,0,0.76)",
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      width: "100%",
      maxWidth: 448,
      maxHeight: "95%",
      padding: 20,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titleRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    eyebrow: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 },
    close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    preview: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, gap: 4 },
    previewName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 },
    previewText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    hint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
    search: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: { flex: 1, minWidth: 0, height: 44, fontSize: 13, color: colors.ink },
    peopleScroll: { maxHeight: 264, flexShrink: 1 },
    people: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 8, rowGap: 16 },
    personSlot: { width: "25%" },
    person: { width: "100%", alignItems: "center", gap: 7, paddingHorizontal: 3 },
    avatar: {
      width: 52,
      height: 52,
      padding: 3,
      borderWidth: 2,
      borderColor: "transparent",
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    avatarSelected: { borderColor: colors.primary },
    avatarImage: { width: "100%", height: "100%", borderRadius: 28, resizeMode: "cover" },
    initial: { fontSize: 22, fontFamily: fonts.bold, color: colors.ink },
    check: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 21,
      height: 21,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.surface,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    personName: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, maxWidth: "100%" },
    selectedName: { color: colors.primary },
    empty: {
      width: "100%",
      paddingVertical: 24,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 19,
      textAlign: "center",
    },
    errorRow: { gap: 5 },
    error: { color: colors.primary, fontSize: 11, lineHeight: 17 },
    retry: { color: colors.ink, fontSize: 11, fontFamily: fonts.bold },
    send: {
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.4 },
    sendText: { fontFamily: fonts.bold, fontSize: 14, color: "#FFFFFF" },
    externalRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 4,
    },
    external: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    externalText: { color: colors.muted, fontSize: 11 },
  });
}
