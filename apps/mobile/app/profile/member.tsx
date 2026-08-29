import type { FeedPost, PublicUser } from "@moveall/contracts";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { ApiError, api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { useAppTheme } from "../../src/theme-context";

export default function MemberFeedPage() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session || !userId) return;
      void api
        .userPosts(session.accessToken, userId)
        .then((result) => {
          setUser(result.user);
          setPosts(result.posts);
        })
        .catch((caught) =>
          setError(caught instanceof ApiError ? caught.message : "피드를 불러오지 못했습니다."),
        );
    }, [session, userId]),
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.back, { color: colors.muted }]}>← BACK</Text>
          </Pressable>
          <Text style={[styles.brand, { color: colors.primary }]}>GROOV</Text>
        </View>
        {!user && !error ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {user ? (
          <View style={styles.identity}>
            {user.avatarDataUri ? (
              <Image source={{ uri: user.avatarDataUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{user.displayName.slice(0, 1)}</Text>
              </View>
            )}
            <View>
              <Text style={[styles.name, { color: colors.ink }]}>{user.displayName}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {posts.length} POSTS + STORIES
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.grid}>
          {posts.map((post) => (
            <View key={post.id} style={[styles.post, { backgroundColor: colors.ink }]}>
              <Text style={[styles.sport, { color: colors.primary }]}>
                {post.contentType.toUpperCase()} · {post.sport.toUpperCase()}
              </Text>
              <Text style={styles.content}>{post.content}</Text>
              <Text style={styles.reaction}>
                ♥ {post.likeCount} ◯ {post.comments.length}
              </Text>
            </View>
          ))}
        </View>
        {user && posts.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            아직 공개한 콘텐츠가 없습니다.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    safe: { flex: 1 },
    page: {
      width: "100%",
      maxWidth: 448,
      alignSelf: "center",
      padding: 22,
      gap: 20,
      paddingBottom: 90,
    },
    top: { flexDirection: "row", justifyContent: "space-between" },
    back: { fontSize: 9, fontWeight: "900" },
    brand: { fontSize: 16, fontWeight: "900", fontStyle: "italic" },
    identity: {
      flexDirection: "row",
      gap: 13,
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 18,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
    name: { fontSize: 22, fontWeight: "900" },
    meta: { fontSize: 7, fontWeight: "900", marginTop: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    post: {
      width: "48.8%",
      minHeight: 180,
      borderRadius: 8,
      padding: 15,
      justifyContent: "space-between",
    },
    sport: { fontSize: 7, fontWeight: "900" },
    content: { color: "#FFFFFF", fontSize: 12, lineHeight: 19, fontWeight: "800" },
    reaction: { color: "#AAAAAA", fontSize: 8 },
    empty: { paddingVertical: 50, textAlign: "center", fontSize: 10 },
    error: { color: "#C94732", fontSize: 10 },
  });
}
