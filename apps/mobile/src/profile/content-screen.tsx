import type { FeedPost } from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { CenterDialog } from "../components/ui";
import { type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";

type Filter = "all" | "post" | "story";

export function ContentScreen({ archived = false }: { archived?: boolean }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeletePost, setPendingDeletePost] = useState<FeedPost | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setPosts(
        archived
          ? await api.archivedPosts(session.accessToken)
          : await api.myPosts(session.accessToken),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "콘텐츠를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [archived, session]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = filter === "all" ? posts : posts.filter((post) => post.contentType === filter);
  const commentCount = posts.reduce((sum, post) => sum + post.comments.length, 0);
  const likeCount = posts.reduce((sum, post) => sum + post.likeCount, 0);

  const update = async (post: FeedPost) => {
    if (!session || !draft.trim()) return;
    setBusyId(post.id);
    try {
      const next = await api.updatePost(session.accessToken, post.id, { content: draft.trim() });
      setPosts((current) =>
        current.map((item) => (item.id === post.id ? { ...item, content: next.content } : item)),
      );
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "수정하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };
  const archive = async (post: FeedPost) => {
    if (!session) return;
    setBusyId(post.id);
    try {
      if (archived) await api.restorePost(session.accessToken, post.id);
      else await api.archivePost(session.accessToken, post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "보관 상태를 변경하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (post: FeedPost) => {
    if (!session) return;
    setBusyId(post.id);
    try {
      await api.deletePost(session.accessToken, post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setPendingDeletePost(null);
      setFeedback("게시물을 삭제했습니다.");
    } catch (caught) {
      setPendingDeletePost(null);
      setError(caught instanceof ApiError ? caught.message : "삭제하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <CenterDialog
        busy={pendingDeletePost ? busyId === pendingDeletePost.id : false}
        confirmLabel={
          pendingDeletePost && busyId === pendingDeletePost.id ? "삭제 중" : "게시물 삭제"
        }
        danger
        eyebrow="DELETE POST"
        message={pendingDeletePost?.content ?? ""}
        onClose={() => setPendingDeletePost(null)}
        onConfirm={() => {
          if (pendingDeletePost) void remove(pendingDeletePost);
        }}
        title="이 게시물을 삭제할까요?"
        visible={pendingDeletePost !== null}
      />
      <CenterDialog
        message={error ?? ""}
        onClose={() => setError(null)}
        title="확인이 필요합니다"
        visible={error !== null && pendingDeletePost === null}
      />
      <CenterDialog
        message={feedback ?? ""}
        onClose={() => setFeedback(null)}
        title="처리했습니다"
        visible={feedback !== null && error === null && pendingDeletePost === null}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          {!archived ? (
            <Pressable onPress={() => router.push("/profile/archive")}>
              <Text style={styles.archiveLink}>ARCHIVE ↗</Text>
            </Pressable>
          ) : (
            <Text style={styles.brand}>GROOV</Text>
          )}
        </View>
        <Text style={styles.eyebrow}>{archived ? "PRIVATE ARCHIVE" : "CONTENT CONTROL"}</Text>
        <Text style={styles.title}>{archived ? "보관함" : "내 콘텐츠"}</Text>
        <Text style={styles.lead}>
          {archived
            ? "프로필에서는 숨기고 나만 볼 수 있는 게시물과 스토리입니다."
            : "게시물과 스토리가 먼저 보이고, 댓글과 좋아요 반응은 각 콘텐츠 아래에서 확인합니다."}
        </Text>
        <View style={styles.summaryRow}>
          <Summary value={posts.length} label="게시물 + 스토리" styles={styles} />
          <Summary value={commentCount} label="댓글" styles={styles} />
          <Summary value={likeCount} label="좋아요" styles={styles} />
        </View>
        <View style={styles.filters}>
          {(["all", "post", "story"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filter, filter === item && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                {item === "all" ? "전체" : item === "post" ? "게시물" : "스토리"}
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        <View style={styles.list}>
          {visible.map((post) => (
            <View key={post.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.kind}>
                  {post.contentType.toUpperCase()} · {post.sport.toUpperCase()}
                </Text>
                <Text style={styles.date}>
                  {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                </Text>
              </View>
              {editingId === post.id ? (
                <TextInput
                  autoFocus
                  multiline
                  value={draft}
                  onChangeText={setDraft}
                  style={styles.editInput}
                />
              ) : (
                <Text style={styles.content}>{post.content}</Text>
              )}
              {post.workoutSessionId ? (
                <Text style={styles.linked}>CONNECTED WORKOUT LOG</Text>
              ) : null}
              <View style={styles.reactions}>
                <Text style={styles.reaction}>♥ 좋아요 {post.likeCount}</Text>
                <Text style={styles.reaction}>◯ 댓글 {post.comments.length}</Text>
              </View>
              {post.comments.length > 0 ? (
                <View style={styles.comments}>
                  {post.comments.slice(0, 3).map((comment) => (
                    <Text key={comment.id} style={styles.comment}>
                      <Text style={styles.commentName}>{comment.authorDisplayName} </Text>
                      {comment.content}
                    </Text>
                  ))}
                </View>
              ) : null}
              <View style={styles.actions}>
                {editingId === post.id ? (
                  <Pressable
                    disabled={busyId === post.id}
                    onPress={() => void update(post)}
                    style={styles.primaryAction}
                  >
                    <Text style={styles.primaryActionText}>저장</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setEditingId(post.id);
                      setDraft(post.content);
                    }}
                    style={styles.action}
                  >
                    <Text style={styles.actionText}>수정</Text>
                  </Pressable>
                )}
                <Pressable
                  disabled={busyId === post.id}
                  onPress={() => void archive(post)}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>{archived ? "복원" : "보관"}</Text>
                </Pressable>
                <Pressable
                  disabled={busyId === post.id}
                  onPress={() => setPendingDeletePost(post)}
                  style={styles.deleteAction}
                >
                  <Text style={styles.deleteText}>삭제</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        {!loading && visible.length === 0 ? (
          <Text style={styles.empty}>
            {archived ? "보관한 콘텐츠가 없습니다." : "표시할 콘텐츠가 없습니다."}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({
  value,
  label,
  styles,
}: {
  value: number;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: 448,
      alignSelf: "center",
      padding: 22,
      paddingBottom: 90,
      gap: 17,
    },
    topBar: { flexDirection: "row", justifyContent: "space-between" },
    back: { color: colors.muted, fontSize: 9, fontWeight: "900" },
    archiveLink: { color: colors.primary, fontSize: 9, fontWeight: "900" },
    brand: { color: colors.primary, fontSize: 15, fontWeight: "900", fontStyle: "italic" },
    eyebrow: { color: colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
    title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
    lead: { color: colors.muted, fontSize: 10, lineHeight: 17 },
    summaryRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 15,
    },
    summary: { flex: 1, alignItems: "center", gap: 3 },
    summaryValue: { color: colors.ink, fontSize: 20, fontWeight: "900" },
    summaryLabel: { color: colors.muted, fontSize: 7, fontWeight: "800" },
    filters: { flexDirection: "row", gap: 7 },
    filter: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
    },
    filterActive: { backgroundColor: colors.primary },
    filterText: { color: colors.muted, fontSize: 8, fontWeight: "900" },
    filterTextActive: { color: "#FFFFFF" },
    list: { gap: 10 },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 15, gap: 12 },
    cardTop: { flexDirection: "row", justifyContent: "space-between" },
    kind: { color: colors.primary, fontSize: 7, fontWeight: "900" },
    date: { color: colors.muted, fontSize: 7 },
    content: { color: colors.ink, fontSize: 14, lineHeight: 22, fontWeight: "800" },
    linked: { color: colors.primary, fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
    reactions: {
      flexDirection: "row",
      gap: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    reaction: { color: colors.muted, fontSize: 8, fontWeight: "800" },
    comments: { gap: 6, backgroundColor: colors.surfaceMuted, padding: 10, borderRadius: 6 },
    comment: { color: colors.muted, fontSize: 8, lineHeight: 13 },
    commentName: { color: colors.ink, fontWeight: "900" },
    actions: { flexDirection: "row", gap: 7 },
    action: {
      flex: 1,
      minHeight: 38,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    actionText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
    primaryAction: {
      flex: 1,
      minHeight: 38,
      backgroundColor: colors.primary,
      borderRadius: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryActionText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
    deleteAction: { minWidth: 58, alignItems: "center", justifyContent: "center" },
    deleteText: { color: colors.primary, fontSize: 8, fontWeight: "900" },
    editInput: {
      color: colors.ink,
      minHeight: 74,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      fontSize: 13,
      lineHeight: 20,
    },
    error: { color: colors.primary, fontSize: 10 },
    empty: { color: colors.muted, textAlign: "center", paddingVertical: 50, fontSize: 10 },
  });
}
