import { sportLabels, sportValues, type SportType } from "@moveall/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { BellButton, Card, PrimaryButton, Screen, StatePanel } from "../../src/components/ui";
import {
  StoryCanvas,
  type StoryBackground,
  type StoryLayer,
  type StoryVisibility,
} from "../../src/components/story-canvas";
import { type MapPoint } from "../../src/components/workout-map.types";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const stories = [
  { name: "내 스토리", icon: "+" },
  { name: "민지", icon: "R" },
  { name: "도윤", icon: "H" },
  { name: "유나", icon: "S" },
  { name: "준", icon: "C" },
];

export default function CommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    draft?: string;
    sport?: string;
    photo?: string;
    background?: string;
    layers?: string;
    storyText?: string;
    distance?: string;
    duration?: string;
    pace?: string;
    points?: string;
    route?: string;
    privacy?: string;
    workoutSessionId?: string;
  }>();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const loader = useCallback(() => api.feed(), []);
  const { data: posts, error, loading, reload } = useAsyncData(loader);
  const [content, setContent] = useState("");
  const [sport, setSport] = useState<SportType>("running");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [cheeredPosts, setCheeredPosts] = useState<string[]>([]);
  const [openComments, setOpenComments] = useState<string[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<string[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followBusyIds, setFollowBusyIds] = useState<string[]>([]);
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [storyBackground, setStoryBackground] = useState<StoryBackground>("photo");
  const [storyLayers, setStoryLayers] = useState<StoryLayer[]>(["record", "route", "points"]);
  const [storyText, setStoryText] = useState("");
  const [storyDistance, setStoryDistance] = useState("0.00");
  const [storyDuration, setStoryDuration] = useState("00:00");
  const [storyPace, setStoryPace] = useState("--'--\"");
  const [storyPoints, setStoryPoints] = useState(0);
  const [storyRoute, setStoryRoute] = useState<MapPoint[]>([]);
  const [storyVisibility, setStoryVisibility] = useState<StoryVisibility>({
    distance: true,
    duration: true,
    pace: true,
    route: true,
    points: true,
  });

  useEffect(() => {
    if (typeof params.draft === "string" && params.draft) {
      setContent(params.draft);
      setComposerOpen(true);
    }
    if (typeof params.sport === "string") {
      const selected = sportValues.find((item) => item === params.sport);
      if (selected) setSport(selected);
    }
    if (typeof params.photo === "string" && params.photo) setDraftPhoto(params.photo);
    if (
      params.background === "photo" ||
      params.background === "map" ||
      params.background === "ink"
    ) {
      setStoryBackground(params.background);
    }
    if (typeof params.layers === "string") setStoryLayers(parseLayers(params.layers));
    if (typeof params.storyText === "string") setStoryText(params.storyText);
    if (typeof params.distance === "string") setStoryDistance(params.distance);
    if (typeof params.duration === "string") setStoryDuration(params.duration);
    if (typeof params.pace === "string") setStoryPace(params.pace);
    if (typeof params.points === "string") setStoryPoints(Number(params.points) || 0);
    if (typeof params.route === "string") setStoryRoute(parseRoute(params.route));
    if (typeof params.privacy === "string") setStoryVisibility(parseVisibility(params.privacy));
  }, [
    params.background,
    params.distance,
    params.draft,
    params.duration,
    params.layers,
    params.pace,
    params.photo,
    params.points,
    params.privacy,
    params.route,
    params.sport,
    params.storyText,
  ]);

  useEffect(() => {
    if (!session) return;
    void api
      .socialSummary(session.accessToken)
      .then((summary) => setFollowingIds(summary.following.map((person) => person.id)))
      .catch(() => setFollowingIds([]));
  }, [session]);

  async function submitPost() {
    if (!session || !content.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const visibleStats = [
        storyVisibility.distance ? `${storyDistance}km` : null,
        storyVisibility.duration ? storyDuration : null,
        storyVisibility.pace ? storyPace : null,
        storyVisibility.points ? `${storyPoints}P` : null,
      ].filter(Boolean);
      const publicContent = visibleStats.length
        ? `${content.trim()}\n${visibleStats.join(" · ")}`
        : content.trim();
      await api.createPost(session.accessToken, {
        sport,
        content: publicContent,
        ...(typeof params.workoutSessionId === "string"
          ? { workoutSessionId: params.workoutSessionId }
          : {}),
      });
      setContent("");
      setDraftPhoto(null);
      setStoryRoute([]);
      setStoryText("");
      setComposerOpen(false);
      router.replace("/community");
      await reload();
    } catch (caught) {
      setPostError(caught instanceof Error ? caught.message : "게시하지 못했습니다.");
    } finally {
      setPosting(false);
    }
  }

  function toggle(id: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleStoryVisibility(key: keyof StoryVisibility) {
    setStoryVisibility((current) => ({ ...current, [key]: !current[key] }));
  }

  async function toggleFollow(userId: string) {
    if (!session || followBusyIds.includes(userId)) return;
    const following = followingIds.includes(userId);
    setFollowBusyIds((current) => [...current, userId]);
    setPostError(null);
    try {
      if (following) await api.unfollow(session.accessToken, userId);
      else await api.follow(session.accessToken, userId);
      setFollowingIds((current) =>
        following ? current.filter((id) => id !== userId) : [...current, userId],
      );
    } catch (caught) {
      setPostError(caught instanceof Error ? caught.message : "팔로우 상태를 바꾸지 못했습니다.");
    } finally {
      setFollowBusyIds((current) => current.filter((id) => id !== userId));
    }
  }

  const hasStoryDraft =
    draftPhoto !== null || storyRoute.length > 1 || typeof params.background === "string";

  return (
    <Screen
      title=""
      action={
        <BellButton
          label="피드 알림 확인"
          onPress={() => setNotificationOpen((current) => !current)}
        />
      }
    >
      <Text style={styles.pageTitle}>함께 움직이는 중</Text>
      {notificationOpen ? <Text style={styles.notice}>새로운 피드 알림이 없습니다.</Text> : null}

      <ScrollView
        contentContainerStyle={styles.stories}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {stories.map((story, index) => {
          const selected = selectedStory === story.name;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={story.name}
              onPress={() => setSelectedStory(selected ? null : story.name)}
              style={styles.story}
            >
              <View style={[styles.storyRing, selected && styles.storyRingSelected]}>
                <View style={[styles.storyAvatar, index === 0 && styles.myStory]}>
                  <Text style={[styles.storyInitial, index === 0 && styles.myStoryText]}>
                    {story.icon}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.storyName}>
                {story.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedStory ? (
        <View style={styles.storyStatus}>
          <Text style={styles.storyStatusText}>{selectedStory}의 운동 스토리를 열었습니다.</Text>
          <Pressable accessibilityRole="button" onPress={() => setSelectedStory(null)}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>
      ) : null}

      <Card style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setComposerOpen(true)}
          style={styles.composerPrompt}
        >
          <View style={styles.miniAvatar}>
            <Text style={styles.miniAvatarText}>
              {session?.user.displayName.slice(0, 1) ?? "M"}
            </Text>
          </View>
          <Text style={styles.composerPromptText}>
            {session ? "오늘의 운동 스토리를 공유해보세요" : "로그인 후 운동을 공유하세요"}
          </Text>
        </Pressable>
        <View style={styles.composerActions}>
          {["▧", "▥", "◎"].map((icon, index) => (
            <Pressable
              accessibilityLabel={["사진 추가", "운동 기록 추가", "카메라 열기"][index]}
              accessibilityRole="button"
              key={icon}
              onPress={() => setComposerOpen(true)}
              style={styles.composerAction}
            >
              <Text style={styles.composerActionIcon}>{icon}</Text>
            </Pressable>
          ))}
        </View>
        {composerOpen && session ? (
          <View style={styles.composerForm}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.sportPicker}>
                {sportValues.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: sport === item }}
                    key={item}
                    onPress={() => setSport(item)}
                    style={[styles.sportChip, sport === item && styles.sportChipActive]}
                  >
                    <Text
                      style={[styles.sportChipText, sport === item && styles.sportChipTextActive]}
                    >
                      {sportLabels[item]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {hasStoryDraft ? (
              <View style={styles.storyPreviewWrap}>
                <StoryCanvas
                  background={storyBackground}
                  colors={colors}
                  customText={storyText}
                  distance={storyDistance}
                  duration={storyDuration}
                  layers={storyLayers}
                  moveScore={storyPoints}
                  pace={storyPace}
                  photoUri={draftPhoto}
                  routePoints={storyRoute}
                  sportLabel={sportLabels[sport]}
                  themeLabel={content.split("·").at(-1)?.trim() || "WORKOUT CUT"}
                  visibility={storyVisibility}
                />
              </View>
            ) : null}
            <TextInput
              accessibilityLabel="운동 이야기"
              multiline
              maxLength={2000}
              onChangeText={setContent}
              placeholder="오늘 어떤 운동을 했나요?"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={content}
            />
            {hasStoryDraft ? (
              <View style={styles.sharePrivacy}>
                <View style={styles.sharePrivacyHeading}>
                  <Text style={styles.sharePrivacyTitle}>올리기 전 공개 범위</Text>
                  <Text style={styles.sharePrivacyMeta}>선택한 정보만 피드에 남습니다.</Text>
                </View>
                <View style={styles.sharePrivacyRow}>
                  {(
                    [
                      ["distance", "거리"],
                      ["duration", "시간"],
                      ["pace", "페이스"],
                      ["route", "경로"],
                      ["points", "점수"],
                    ] as Array<[keyof StoryVisibility, string]>
                  ).map(([key, label]) => (
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: storyVisibility[key] }}
                      key={key}
                      onPress={() => toggleStoryVisibility(key)}
                      style={[
                        styles.sharePrivacyChip,
                        storyVisibility[key] && styles.sharePrivacyChipActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.sharePrivacyDot,
                          storyVisibility[key] && styles.sharePrivacyDotActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.sharePrivacyText,
                          storyVisibility[key] && styles.sharePrivacyTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {postError ? <Text style={styles.error}>{postError}</Text> : null}
            <PrimaryButton
              label={posting ? "공유 중..." : "피드에 공유"}
              disabled={posting || !content.trim()}
              onPress={() => void submitPost()}
            />
          </View>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>최신 피드</Text>
      {loading ? <StatePanel state="loading" message="피드를 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {posts?.length === 0 ? <StatePanel state="empty" message="첫 기록을 공유해 보세요." /> : null}
      {posts?.map((post) => {
        const cheered = cheeredPosts.includes(post.id);
        const commentsOpen = openComments.includes(post.id);
        const bookmarked = bookmarkedPosts.includes(post.id);
        return (
          <View key={post.id} style={styles.post}>
            <View style={styles.postHeader}>
              <View style={styles.authorRow}>
                <View style={styles.authorAvatar}>
                  <Text style={styles.authorInitial}>{post.authorDisplayName.slice(0, 1)}</Text>
                </View>
                <Text style={styles.author}>{post.authorDisplayName}</Text>
              </View>
              <View style={styles.postHeaderMeta}>
                {session?.user.id !== post.userId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void toggleFollow(post.userId)}
                    style={[
                      styles.followButton,
                      followingIds.includes(post.userId) && styles.followButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.followText,
                        followingIds.includes(post.userId) && styles.followTextActive,
                      ]}
                    >
                      {followBusyIds.includes(post.userId)
                        ? "…"
                        : followingIds.includes(post.userId)
                          ? "팔로잉"
                          : "+ 팔로우"}
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={styles.time}>2시간 전</Text>
              </View>
            </View>
            <View style={styles.feedArtwork}>
              <Text style={styles.feedArtworkBrand}>MOVE STORY</Text>
              <View style={styles.feedArtworkMark} />
              <Text style={styles.feedArtworkSport}>{sportLabels[post.sport]}</Text>
              <Text style={styles.feedArtworkMeta}>SHARED TODAY</Text>
            </View>
            <Text style={styles.postCopy}>{post.content}</Text>
            <Text style={styles.tags}>#아침러닝 #이지런 #완주</Text>
            <View style={styles.postActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(post.id, cheeredPosts, setCheeredPosts)}
                style={styles.action}
              >
                <Text style={[styles.actionText, cheered && styles.activeAction]}>
                  {cheered ? "♥" : "♡"} {cheered ? 43 : 42}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(post.id, openComments, setOpenComments)}
                style={styles.action}
              >
                <Text style={styles.actionText}>○ {post.comments.length}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setComposerOpen(true)}
                style={styles.action}
              >
                <Text style={styles.actionText}>↗</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(post.id, bookmarkedPosts, setBookmarkedPosts)}
                style={styles.bookmark}
              >
                <Text style={[styles.actionText, bookmarked && styles.activeAction]}>
                  {bookmarked ? "▣" : "▢"}
                </Text>
              </Pressable>
            </View>
            {commentsOpen ? (
              <View style={styles.comments}>
                {post.comments.length ? (
                  post.comments.map((comment) => (
                    <Text key={comment.id} style={styles.comment}>
                      <Text style={styles.commentAuthor}>{comment.authorDisplayName}</Text>{" "}
                      {comment.content}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyComment}>아직 댓글이 없습니다.</Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const defaultStoryLayers: StoryLayer[] = ["record", "route", "points"];

function parseLayers(value: string): StoryLayer[] {
  const validLayers: StoryLayer[] = ["record", "route", "text", "points"];
  const layers = value
    .split(",")
    .filter((layer): layer is StoryLayer => validLayers.includes(layer as StoryLayer));
  return layers.length ? layers : defaultStoryLayers;
}

function parseRoute(value: string): MapPoint[] {
  try {
    const route: unknown = JSON.parse(value);
    if (!Array.isArray(route)) return [];
    return route
      .filter(
        (point): point is MapPoint =>
          typeof point === "object" &&
          point !== null &&
          typeof (point as MapPoint).latitude === "number" &&
          typeof (point as MapPoint).longitude === "number",
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function parseVisibility(value: string): StoryVisibility {
  const fallback: StoryVisibility = {
    distance: true,
    duration: true,
    pace: true,
    route: true,
    points: true,
  };
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    return Object.fromEntries(
      Object.entries(fallback).map(([key, defaultValue]) => [
        key,
        typeof (parsed as Record<string, unknown>)[key] === "boolean"
          ? (parsed as Record<string, boolean>)[key]
          : defaultValue,
      ]),
    ) as StoryVisibility;
  } catch {
    return fallback;
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pageTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
    notice: { color: colors.primary, fontSize: 10, marginTop: -9 },
    stories: { gap: 12, paddingVertical: 3, paddingRight: 14 },
    story: { width: 53, alignItems: "center", gap: 5 },
    storyRing: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    storyRingSelected: { borderWidth: 2, borderColor: colors.primary },
    storyAvatar: {
      width: 39,
      height: 39,
      borderRadius: 20,
      backgroundColor: colors.hero,
      alignItems: "center",
      justifyContent: "center",
    },
    myStory: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    storyInitial: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
    myStoryText: { color: colors.primary, fontSize: 22, fontWeight: "300" },
    storyName: { color: colors.ink, fontSize: 9 },
    storyStatus: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
    },
    storyStatusText: { color: colors.muted, fontSize: 10 },
    close: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    composer: { padding: 0, overflow: "hidden" },
    composerPrompt: {
      minHeight: 57,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    miniAvatarText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    composerPromptText: { color: colors.muted, fontSize: 11 },
    composerActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
    composerAction: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" },
    composerActionIcon: { color: colors.ink, fontSize: 18, fontWeight: "300" },
    composerForm: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
    sportPicker: { flexDirection: "row", gap: 6, paddingBottom: 9 },
    sportChip: {
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceMuted,
    },
    sportChipActive: { backgroundColor: colors.primary },
    sportChipText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    sportChipTextActive: { color: "#FFFFFF" },
    storyPreviewWrap: { marginBottom: 10 },
    sharePrivacy: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 11,
      marginBottom: 11,
      gap: 9,
    },
    sharePrivacyHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sharePrivacyTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
    sharePrivacyMeta: { color: colors.muted, fontSize: 8 },
    sharePrivacyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    sharePrivacyChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 30,
      paddingHorizontal: 9,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sharePrivacyChipActive: { borderColor: colors.ink },
    sharePrivacyDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    sharePrivacyDotActive: { backgroundColor: colors.primary },
    sharePrivacyText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    sharePrivacyTextActive: { color: colors.ink },
    input: {
      minHeight: 78,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 7,
      padding: 10,
      textAlignVertical: "top",
      marginBottom: 9,
    },
    error: { color: colors.danger, fontSize: 10, marginBottom: 8 },
    sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
    post: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16 },
    postHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    authorAvatar: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    authorInitial: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    author: { color: colors.ink, fontSize: 12, fontWeight: "800" },
    postHeaderMeta: { flexDirection: "row", alignItems: "center", gap: 9 },
    followButton: {
      minHeight: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    followButtonActive: { backgroundColor: colors.surfaceMuted },
    followText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
    followTextActive: { color: colors.ink },
    time: { color: colors.muted, fontSize: 10 },
    feedArtwork: {
      height: 238,
      borderRadius: 9,
      overflow: "hidden",
      backgroundColor: colors.hero,
      padding: 18,
      justifyContent: "flex-end",
    },
    feedArtworkBrand: {
      position: "absolute",
      left: 18,
      top: 17,
      color: colors.primary,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    feedArtworkMark: {
      position: "absolute",
      width: 170,
      height: 170,
      borderRadius: 85,
      right: -38,
      top: 25,
      borderWidth: 22,
      borderColor: "rgba(255,255,255,0.06)",
    },
    feedArtworkSport: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
    feedArtworkMeta: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.3,
      marginTop: 5,
    },
    postCopy: { color: colors.ink, fontSize: 12, lineHeight: 19, marginTop: 11 },
    tags: { color: colors.muted, fontSize: 11, marginTop: 6 },
    postActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
    action: { minHeight: 30, justifyContent: "center" },
    actionText: { color: colors.ink, fontSize: 15, fontWeight: "400" },
    activeAction: { color: colors.primary },
    bookmark: { minHeight: 30, justifyContent: "center", marginLeft: "auto" },
    comments: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 5 },
    comment: { color: colors.ink, fontSize: 11, lineHeight: 17 },
    commentAuthor: { fontWeight: "900" },
    emptyComment: { color: colors.muted, fontSize: 10 },
  });
}
