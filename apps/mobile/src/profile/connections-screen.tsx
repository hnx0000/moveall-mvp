import type { PublicUser, SocialSummary } from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";

const emptySocial: SocialSummary = {
  followersCount: 0,
  followingCount: 0,
  followers: [],
  following: [],
};

export function ConnectionsScreen({ mode }: { mode: "followers" | "following" }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const [social, setSocial] = useState(emptySocial);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setSocial(await api.socialSummary(session.accessToken));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const people = mode === "followers" ? social.followers : social.following;

  const disconnect = async (person: PublicUser) => {
    if (!session) return;
    setBusyId(person.id);
    setError(null);
    try {
      if (mode === "followers") await api.removeFollower(session.accessToken, person.id);
      else await api.unfollow(session.accessToken, person.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "관계를 변경하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const block = async (person: PublicUser) => {
    if (!session) return;
    setBusyId(person.id);
    setError(null);
    try {
      await api.blockUser(session.accessToken, person.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "차단하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          <Text style={styles.brand}>MOVEALL</Text>
        </View>
        <Text style={styles.eyebrow}>SOCIAL CONTROL</Text>
        <Text style={styles.title}>{mode === "followers" ? "팔로워" : "팔로잉"}</Text>
        <Text style={styles.lead}>
          {mode === "followers"
            ? "나를 팔로우하는 사람을 확인하고 삭제하거나 차단합니다."
            : "내가 팔로우하는 사람의 피드를 방문하고 관계를 관리합니다."}
        </Text>
        <View style={styles.countLine}>
          <Text style={styles.count}>{people.length}</Text>
          <Text style={styles.countLabel}>ACTIVE CONNECTIONS</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && people.length === 0 ? (
          <Text style={styles.empty}>현재 표시할 계정이 없습니다.</Text>
        ) : null}
        <View style={styles.list}>
          {people.map((person) => (
            <View key={person.id} style={styles.card}>
              {person.avatarDataUri ? (
                <Image source={{ uri: person.avatarDataUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {person.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.personCopy}>
                <Text style={styles.name}>{person.displayName}</Text>
                <Text style={styles.status}>MOVEALL MEMBER</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/profile/member", params: { userId: person.id } })
                  }
                  style={styles.actionPrimary}
                >
                  <Text style={styles.actionPrimaryText}>피드</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/profile/message",
                      params: { userId: person.id, name: person.displayName },
                    })
                  }
                  style={styles.action}
                >
                  <Text style={styles.actionText}>메시지</Text>
                </Pressable>
                <Pressable
                  disabled={busyId === person.id}
                  onPress={() => void disconnect(person)}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>
                    {mode === "followers" ? "삭제" : "언팔로우"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busyId === person.id}
                  onPress={() => void block(person)}
                  style={styles.blockAction}
                >
                  <Text style={styles.blockText}>차단</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
      padding: 22,
      paddingBottom: 90,
      gap: 17,
    },
    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    back: { color: colors.muted, fontSize: 9, fontWeight: "900" },
    brand: { color: colors.primary, fontSize: 16, fontWeight: "900", fontStyle: "italic" },
    eyebrow: { color: colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
    title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
    lead: { color: colors.muted, fontSize: 10, lineHeight: 17 },
    countLine: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 13,
    },
    count: { color: colors.ink, fontSize: 28, fontWeight: "900" },
    countLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
    list: { gap: 8 },
    card: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 15,
      gap: 12,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
    personCopy: { flex: 1, minWidth: 130 },
    name: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    status: {
      color: colors.muted,
      fontSize: 6,
      fontWeight: "900",
      marginTop: 3,
      letterSpacing: 0.6,
    },
    actions: { width: "100%", flexDirection: "row", gap: 6 },
    actionPrimary: {
      flex: 1,
      minHeight: 36,
      borderRadius: 5,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    actionPrimaryText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
    action: {
      flex: 1,
      minHeight: 36,
      borderRadius: 5,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    actionText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
    blockAction: { minWidth: 58, minHeight: 36, alignItems: "center", justifyContent: "center" },
    blockText: { color: "#C94732", fontSize: 8, fontWeight: "900" },
    error: { color: "#C94732", fontSize: 10 },
    empty: { color: colors.muted, textAlign: "center", paddingVertical: 50, fontSize: 10 },
  });
}
