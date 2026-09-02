import type { FeedComment, FeedPost } from "@moveall/contracts";
import { Heart, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { api } from "../api/client";
import { fonts, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";
import { commentThreads } from "./comment-threads";

export function PostComments({
  post,
  token,
  userId,
  avatarSource,
  onProfile,
  onReport,
  onChange,
  onNotice,
}: {
  post: FeedPost;
  token: string | undefined;
  userId: string | undefined;
  avatarSource: (userId: string) => ImageSourcePropType | null;
  onProfile: (userId: string) => void;
  onReport: (commentId: string) => void;
  onChange: (comment: FeedComment) => void;
  onNotice: (message: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [busyLikes, setBusyLikes] = useState<string[]>([]);
  const busy = useRef(new Set<string>());
  const inputRef = useRef<TextInput>(null);

  async function submit() {
    if (!token || !draft.trim() || busy.current.has("submit")) return;
    busy.current.add("submit");
    setPosting(true);
    try {
      const comment = await api.createComment(token, post.id, {
        content: draft.trim(),
        ...(replyTo ? { parentCommentId: replyTo.id } : {}),
      });
      onChange(comment);
      setDraft("");
      setReplyTo(null);
    } catch (error) {
      onNotice(
        error instanceof Error ? error.message : "댓글을 등록하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      busy.current.delete("submit");
      setPosting(false);
    }
  }

  async function toggleLike(comment: FeedComment) {
    if (!token || busy.current.has(comment.id)) return;
    busy.current.add(comment.id);
    setBusyLikes((ids) => [...ids, comment.id]);
    try {
      onChange(await api.setCommentLiked(token, post.id, comment.id, !comment.likedByMe));
    } catch (error) {
      onNotice(
        error instanceof Error
          ? error.message
          : "좋아요를 저장하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      busy.current.delete(comment.id);
      setBusyLikes((ids) => ids.filter((id) => id !== comment.id));
    }
  }

  function renderComment(comment: FeedComment, isReply = false) {
    const source = avatarSource(comment.userId);
    return (
      <View key={comment.id} style={[styles.comment, isReply && styles.reply]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${comment.authorDisplayName} 프로필 보기`}
          onPress={() => onProfile(comment.userId)}
          style={styles.avatar}
        >
          {source ? (
            <Image source={source} style={styles.avatarImage} />
          ) : (
            <Text style={styles.initial}>{comment.authorDisplayName.slice(0, 1)}</Text>
          )}
        </Pressable>
        <View style={styles.body}>
          <Pressable accessibilityRole="button" onPress={() => onProfile(comment.userId)}>
            <Text style={styles.author}>{comment.authorDisplayName}</Text>
          </Pressable>
          <Text style={styles.content}>{comment.content}</Text>
          <View style={styles.actions}>
            {!isReply ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${comment.authorDisplayName} 댓글에 답글 달기`}
                disabled={!token || posting}
                onPress={() => {
                  setReplyTo(comment);
                  inputRef.current?.focus();
                }}
                style={styles.textAction}
              >
                <Text style={styles.actionText}>답글 달기</Text>
              </Pressable>
            ) : null}
            {userId && userId !== comment.userId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="댓글 신고"
                onPress={() => onReport(comment.id)}
                style={styles.textAction}
              >
                <Text style={styles.actionText}>신고</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`댓글 좋아요 ${comment.likedByMe ? "취소" : "누르기"}, ${comment.likeCount}개`}
          accessibilityState={{
            selected: comment.likedByMe,
            disabled: !token || busyLikes.includes(comment.id),
          }}
          disabled={!token || busyLikes.includes(comment.id)}
          onPress={() => void toggleLike(comment)}
          style={styles.like}
        >
          <Heart
            size={15}
            color={comment.likedByMe ? colors.primary : colors.muted}
            fill={comment.likedByMe ? colors.primary : "none"}
            strokeWidth={1.7}
          />
          <Text style={[styles.likeCount, comment.likedByMe && { color: colors.primary }]}>
            {comment.likeCount}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {post.comments.length ? (
        commentThreads(post.comments).map(({ comment, replies }) => (
          <View key={comment.id} style={styles.thread}>
            {renderComment(comment)}
            {replies.map((reply) => renderComment(reply, true))}
          </View>
        ))
      ) : (
        <Text style={styles.empty}>아직 댓글이 없습니다.</Text>
      )}
      {replyTo ? (
        <View style={styles.replyTarget}>
          <Text style={styles.replyTargetText} numberOfLines={1}>
            {replyTo.authorDisplayName}님에게 답글 작성 중
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="답글 취소"
            disabled={posting}
            onPress={() => setReplyTo(null)}
            hitSlop={10}
          >
            <X size={16} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={replyTo ? "답글 입력" : "댓글 입력"}
          editable={Boolean(token) && !posting}
          maxLength={500}
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
          placeholder={
            !token
              ? "로그인 후 댓글을 남겨주세요"
              : replyTo
                ? "답글을 남겨보세요"
                : "응원과 정보를 나눠보세요"
          }
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          style={styles.input}
          value={draft}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={replyTo ? "답글 등록" : "댓글 등록"}
          disabled={!token || !draft.trim() || posting}
          onPress={() => void submit()}
          style={[styles.submit, (!token || !draft.trim() || posting) && styles.disabled]}
        >
          <Text style={styles.submitText}>{posting ? "…" : "등록"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 12 },
    thread: { gap: 10 },
    comment: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    reply: { marginLeft: 32, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: colors.border },
    avatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
    initial: { color: colors.primary, fontSize: 11, fontFamily: fonts.bold },
    body: { flex: 1, minWidth: 0 },
    author: { fontSize: 11, fontFamily: fonts.bold, color: colors.ink },
    content: { fontSize: 12, lineHeight: 19, color: colors.ink, marginTop: 3 },
    actions: { flexDirection: "row", gap: 12 },
    textAction: { minHeight: 28, justifyContent: "center" },
    actionText: { fontSize: 10, color: colors.muted, fontFamily: fonts.medium },
    like: { minWidth: 40, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 3 },
    likeCount: { fontSize: 10, color: colors.muted, fontFamily: fonts.medium },
    empty: { fontSize: 11, color: colors.muted },
    replyTarget: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
    },
    replyTargetText: { flex: 1, fontSize: 11, color: colors.primary },
    composer: { flexDirection: "row", gap: 8 },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 12,
      color: colors.ink,
      backgroundColor: colors.surfaceMuted,
    },
    submit: {
      minWidth: 48,
      minHeight: 42,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    submitText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 11 },
    disabled: { opacity: 0.45 },
  });
}
