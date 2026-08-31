import {
  sportLabels,
  sportValues,
  type FeedPost,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BarChart3,
  Bookmark,
  Camera,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Send,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import feedRunImage from "../../assets/images/feed-run.jpg";
import storyDiving01 from "../../assets/images/story-diving-01.jpg";
import storyDiving02 from "../../assets/images/story-diving-02.png";
import storyStrength01 from "../../assets/images/story-strength-01.jpg";
import storyStrength02 from "../../assets/images/story-strength-02.jpg";
import storyStrength03 from "../../assets/images/story-strength-03.jpg";
import storySwimming01 from "../../assets/images/story-swimming-01.jpg";
import storySwimming02 from "../../assets/images/story-swimming-02.jpg";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { BellButton, Card, PrimaryButton, Screen, StatePanel } from "../../src/components/ui";
import {
  StoryCanvas,
  type StoryBackground,
  type StoryLayer,
  type StoryLayout,
  type StoryVisibility,
} from "../../src/components/story-canvas";
import { type MapPoint } from "../../src/components/workout-map.types";
import { saveRecordGoal } from "../../src/goals";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { fonts, gradients, radius, space, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type DemoStory = {
  id: string;
  sport: SportType;
  background: StoryBackground;
  photo?: ImageSourcePropType;
  themeLabel: string;
  customText: string;
  distance: string;
  distanceUnit: string;
  duration: string;
  layout: StoryLayout;
  pace: string;
  points: number;
  routePoints: MapPoint[];
};

type StoryOwner = {
  id: string;
  profileUserId?: string;
  name: string;
  icon: string;
  stories: DemoStory[];
};

const runningRoute: MapPoint[] = [
  { latitude: 37.5202, longitude: 126.9944 },
  { latitude: 37.5215, longitude: 127.0015 },
  { latitude: 37.5196, longitude: 127.0098 },
  { latitude: 37.5168, longitude: 127.0172 },
  { latitude: 37.5191, longitude: 127.0248 },
  { latitude: 37.5227, longitude: 127.0319 },
];

const hikingRoute: MapPoint[] = [
  { latitude: 37.6584, longitude: 126.9771 },
  { latitude: 37.6612, longitude: 126.9744 },
  { latitude: 37.6645, longitude: 126.9791 },
  { latitude: 37.6678, longitude: 126.9752 },
  { latitude: 37.6708, longitude: 126.9789 },
];

const cyclingRoute: MapPoint[] = [
  { latitude: 37.5265, longitude: 126.9349 },
  { latitude: 37.5243, longitude: 126.9511 },
  { latitude: 37.5258, longitude: 126.9713 },
  { latitude: 37.5188, longitude: 126.9956 },
  { latitude: 37.5163, longitude: 127.0202 },
  { latitude: 37.5214, longitude: 127.0414 },
];

const baseStories: Record<SportType, DemoStory> = {
  running: demoStory(
    "running",
    "map",
    "SUNSET 5K",
    "도시가 느려지는 시간.",
    "5.20",
    "KM",
    "31:00",
    "5'58\"",
    552,
    runningRoute,
  ),
  hiking: demoStory(
    "hiking",
    "map",
    "ABOVE SEOUL",
    "오늘의 정상은 여기.",
    "6.42",
    "KM",
    "02:06:00",
    "--'--\"",
    918,
    hikingRoute,
  ),
  cycling: demoStory(
    "cycling",
    "map",
    "RIVER RIDE",
    "바람이 루트를 만든다.",
    "31.48",
    "KM",
    "01:34:00",
    "20.1 KM/H",
    1286,
    cyclingRoute,
  ),
  strength: demoStory(
    "strength",
    "photo",
    "BODY CHECK",
    "오늘의 눈바디.",
    "8",
    "MOVES",
    "52:00",
    "16 SET",
    684,
    [],
    storyStrength01,
  ),
  swimming: demoStory(
    "swimming",
    "photo",
    "BLUE LANE",
    "물속에서 정리한 호흡.",
    "1,200",
    "M",
    "42:00",
    "48 LAP",
    596,
    [],
    storySwimming01,
  ),
  diving: demoStory(
    "diving",
    "photo",
    "DEEP FOCUS",
    "고요한 18미터.",
    "18",
    "M PB",
    "55:00",
    "42 M DYNAMIC",
    742,
    [],
    storyDiving01,
  ),
};

const storyOwners: StoryOwner[] = [
  {
    id: "me",
    name: "내 스토리",
    icon: "M",
    stories: [
      baseStories.running,
      baseStories.hiking,
      baseStories.cycling,
      baseStories.strength,
      baseStories.swimming,
      baseStories.diving,
    ],
  },
  {
    id: "minji",
    profileUserId: "demo-friend-1",
    name: "민지",
    icon: "R",
    stories: [
      { ...baseStories.running, id: "minji-running", customText: "새벽 6시, 가볍게." },
      {
        ...baseStories.strength,
        id: "minji-strength",
        layout: "split",
        photo: storyStrength02,
        customText: "등 운동 끝.",
      },
    ],
  },
  {
    id: "doyun",
    profileUserId: "demo-friend-3",
    name: "도윤",
    icon: "H",
    stories: [
      {
        ...baseStories.hiking,
        id: "doyun-hiking",
        layout: "low",
        customText: "능선의 바람.",
      },
      { ...baseStories.cycling, id: "doyun-cycling", customText: "한강 30K." },
    ],
  },
  {
    id: "yuna",
    profileUserId: "demo-friend-4",
    name: "유나",
    icon: "S",
    stories: [
      {
        ...baseStories.strength,
        id: "yuna-strength",
        layout: "editorial",
        photo: storyStrength03,
        customText: "오늘도 나답게.",
      },
      {
        ...baseStories.swimming,
        id: "yuna-swimming",
        layout: "low",
        photo: storySwimming02,
        customText: "1,700m clear.",
      },
    ],
  },
  {
    id: "jun",
    profileUserId: "demo-friend-2",
    name: "준",
    icon: "C",
    stories: [
      { ...baseStories.cycling, id: "jun-cycling", customText: "페이스 유지." },
      {
        ...baseStories.running,
        id: "jun-running",
        layout: "centered",
        customText: "마지막 1K push.",
      },
    ],
  },
  {
    id: "harin",
    profileUserId: "demo-friend-private",
    name: "하린",
    icon: "W",
    stories: [
      {
        ...baseStories.swimming,
        id: "harin-swimming",
        layout: "split",
        customText: "레인 끝의 평온.",
      },
      {
        ...baseStories.diving,
        id: "harin-diving",
        layout: "centered",
        photo: storyDiving02,
        customText: "블루홀에서 마주친 순간.",
      },
    ],
  },
  {
    id: "taeo",
    profileUserId: "demo-friend-6",
    name: "태오",
    icon: "T",
    stories: [
      {
        ...baseStories.hiking,
        id: "taeo-hiking",
        layout: "editorial",
        customText: "일몰 전 정상.",
      },
      {
        ...baseStories.diving,
        id: "taeo-diving",
        layout: "low",
        customText: "다이나믹 42m.",
      },
    ],
  },
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
  const [selectedStoryOwnerId, setSelectedStoryOwnerId] = useState<string | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyCanvasWidth, setStoryCanvasWidth] = useState(0);
  const storyScrollRef = useRef<ScrollView>(null);
  const storyScrollOffsetRef = useRef(0);
  const storyDragStartOffsetRef = useRef(0);
  const storyPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          storyDragStartOffsetRef.current = storyScrollOffsetRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const nextOffset = Math.max(0, storyDragStartOffsetRef.current - gesture.dx);
          storyScrollRef.current?.scrollTo({ x: nextOffset, animated: false });
          storyScrollOffsetRef.current = nextOffset;
        },
      }),
    [],
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [cheeredPosts, setCheeredPosts] = useState<string[]>([]);
  const [openComments, setOpenComments] = useState<string[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusyIds, setCommentBusyIds] = useState<string[]>([]);
  const [sharedCounts, setSharedCounts] = useState<Record<string, number>>({});
  const [feedNotice, setFeedNotice] = useState<string | null>(null);
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [goalPost, setGoalPost] = useState<FeedPost | null>(null);
  const [goalPrivate, setGoalPrivate] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followBusyIds, setFollowBusyIds] = useState<string[]>([]);
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [todayWorkoutOptions, setTodayWorkoutOptions] = useState<WorkoutSession[]>([]);
  const [workoutPickerOpen, setWorkoutPickerOpen] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
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
  const selectedStoryOwner = useMemo(
    () => storyOwners.find((owner) => owner.id === selectedStoryOwnerId) ?? null,
    [selectedStoryOwnerId],
  );
  const activeDemoStory = selectedStoryOwner?.stories[storyIndex] ?? null;

  function openStory(ownerId: string) {
    setStoryIndex(0);
    setSelectedStoryOwnerId(ownerId);
  }

  function closeStory() {
    setSelectedStoryOwnerId(null);
    setStoryIndex(0);
  }

  function openMemberProfile(userId?: string) {
    closeStory();
    if (!userId || userId === session?.user.id) {
      router.push("/profile");
      return;
    }
    router.push({ pathname: "/profile/member", params: { userId } });
  }

  function showPreviousStory() {
    if (!selectedStoryOwner) return;
    if (storyIndex > 0) {
      setStoryIndex((current) => current - 1);
      return;
    }
    const ownerIndex = storyOwners.findIndex((owner) => owner.id === selectedStoryOwner.id);
    const previousOwner = storyOwners[ownerIndex - 1];
    if (!previousOwner) return;
    setSelectedStoryOwnerId(previousOwner.id);
    setStoryIndex(previousOwner.stories.length - 1);
  }

  function showNextStory() {
    if (!selectedStoryOwner) return;
    if (storyIndex < selectedStoryOwner.stories.length - 1) {
      setStoryIndex((current) => current + 1);
      return;
    }
    const ownerIndex = storyOwners.findIndex((owner) => owner.id === selectedStoryOwner.id);
    const nextOwner = storyOwners[ownerIndex + 1];
    if (!nextOwner) {
      closeStory();
      return;
    }
    setSelectedStoryOwnerId(nextOwner.id);
    setStoryIndex(0);
  }

  useEffect(() => {
    if (!selectedStoryOwnerId || !selectedStoryOwner) return;
    const timer = setTimeout(() => {
      if (storyIndex < selectedStoryOwner.stories.length - 1) {
        setStoryIndex((current) => current + 1);
        return;
      }
      const ownerIndex = storyOwners.findIndex((owner) => owner.id === selectedStoryOwner.id);
      const nextOwner = storyOwners[ownerIndex + 1];
      if (nextOwner) {
        setSelectedStoryOwnerId(nextOwner.id);
        setStoryIndex(0);
      } else {
        setSelectedStoryOwnerId(null);
        setStoryIndex(0);
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [selectedStoryOwner, selectedStoryOwnerId, storyIndex]);

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

  useEffect(() => {
    if (!session) return;
    void api
      .workouts(session.accessToken)
      .then((items) =>
        setTodayWorkoutOptions(
          items.filter((workout) => isSameLocalDay(new Date(workout.endedAt), new Date())),
        ),
      )
      .catch(() => setTodayWorkoutOptions([]));
  }, [session]);

  async function pickComposerMedia(source: "camera" | "library") {
    setMediaBusy(true);
    setPostError(null);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPostError(
          source === "camera"
            ? "사진 촬영을 위해 카메라 권한을 허용해 주세요."
            : "갤러리를 열기 위해 사진 권한을 허용해 주세요.",
        );
        return;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      if (!result.canceled && result.assets[0]?.uri) {
        setDraftPhoto(result.assets[0].uri);
        setStoryBackground("photo");
        setStoryLayers((current) =>
          current.includes("record") ? current : (["record", ...current] as StoryLayer[]),
        );
        setComposerOpen(true);
      }
    } catch (caught) {
      setPostError(caught instanceof Error ? caught.message : "사진을 불러오지 못했습니다.");
    } finally {
      setMediaBusy(false);
    }
  }

  function applyWorkoutToComposer(workout: WorkoutSession) {
    const durationSeconds = Math.max(
      1,
      Math.round((Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000),
    );
    const distanceKm = Number(workout.metrics.distanceKm ?? 0);
    const distanceM = Number(workout.metrics.distanceM ?? distanceKm * 1000);
    const paceSeconds = Number(workout.metrics.paceSeconds ?? workout.metrics.swimPaceSeconds ?? 0);
    setSport(workout.sport);
    setSelectedWorkoutId(workout.id);
    setStoryDistance(
      workout.sport === "swimming" || workout.sport === "diving"
        ? String(Math.round(distanceM || Number(workout.metrics.dynamicDistanceM ?? 0)))
        : distanceKm.toFixed(2),
    );
    setStoryDuration(formatElapsed(durationSeconds));
    setStoryPace(
      workout.sport === "cycling"
        ? `${Number(workout.metrics.averageSpeedKmh ?? 0).toFixed(1)} KM/H`
        : formatPace(paceSeconds),
    );
    setStoryPoints(Math.round(Number(workout.metrics.calories ?? 0)));
    setStoryBackground(draftPhoto ? "photo" : "ink");
    setStoryLayers(["record", "points"]);
    setWorkoutPickerOpen(false);
    setComposerOpen(true);
  }

  async function submitPost() {
    if (!session || !content.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const visibleStats = hasStoryDraft
        ? [
            storyVisibility.distance ? storyDistance : null,
            storyVisibility.duration ? storyDuration : null,
            storyVisibility.pace ? storyPace : null,
            storyVisibility.points ? `${storyPoints}P` : null,
          ].filter(Boolean)
        : [];
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
      setSelectedWorkoutId(null);
      setWorkoutPickerOpen(false);
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

  async function submitComment(postId: string) {
    if (!session || commentBusyIds.includes(postId)) return;
    const content = commentDrafts[postId]?.trim();
    if (!content) return;
    setCommentBusyIds((current) => [...current, postId]);
    setFeedNotice(null);
    try {
      await api.createComment(session.accessToken, postId, { content });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await reload();
    } catch (caught) {
      setFeedNotice(caught instanceof Error ? caught.message : "댓글을 등록하지 못했습니다.");
    } finally {
      setCommentBusyIds((current) => current.filter((id) => id !== postId));
    }
  }

  async function shareWithFollowing(postId: string) {
    if (!session) return;
    setFeedNotice(null);
    try {
      const result = await api.sharePost(session.accessToken, postId);
      setSharedCounts((current) => ({ ...current, [postId]: result.shareCount }));
      setFeedNotice(
        result.recipientCount > 0
          ? `팔로잉 중인 친구 ${result.recipientCount}명의 공유함에 보냈습니다.`
          : "먼저 친구를 팔로우하면 해당 친구에게 기록을 공유할 수 있어요.",
      );
    } catch (caught) {
      setFeedNotice(caught instanceof Error ? caught.message : "공유하지 못했습니다.");
    }
  }

  function createGoal() {
    if (!goalPost) return;
    saveRecordGoal({
      postId: goalPost.id,
      authorName: goalPost.authorDisplayName,
      sport: goalPost.sport,
      content: goalPost.content,
      private: goalPrivate,
    });
    setBookmarkedPosts((current) =>
      current.includes(goalPost.id) ? current : [...current, goalPost.id],
    );
    setFeedNotice(
      goalPrivate
        ? "비공개 목표로 저장했습니다. 상대방에게 알림이 가지 않습니다."
        : "기록을 존중하는 공개 목표로 저장했습니다.",
    );
    setGoalPost(null);
    setGoalPrivate(false);
  }

  const hasStoryDraft =
    draftPhoto !== null ||
    selectedWorkoutId !== null ||
    storyRoute.length > 1 ||
    typeof params.background === "string";
  const normalizedHashtag = (activeHashtag ?? hashtagSearch.trim()).replace(/^#/, "").toLowerCase();
  const visiblePosts = posts?.filter(
    (post) => !normalizedHashtag || extractHashtags(post.content).includes(normalizedHashtag),
  );

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
      {feedNotice ? <Text style={styles.feedNotice}>{feedNotice}</Text> : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setGoalPost(null)}
        transparent
        visible={goalPost !== null}
      >
        <View style={styles.goalModalBackdrop}>
          <View style={styles.goalModalCard}>
            <Text style={styles.goalModalEyebrow}>RESPECT & CHALLENGE</Text>
            <Text style={styles.goalModalTitle}>이 기록을 목표로 삼을까요?</Text>
            <Text style={styles.goalModalCopy} numberOfLines={3}>
              {goalPost?.content}
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: goalPrivate }}
              onPress={() => setGoalPrivate((current) => !current)}
              style={styles.goalPrivacyRow}
            >
              <View style={[styles.goalCheck, goalPrivate && styles.goalCheckActive]}>
                {goalPrivate ? <Text style={styles.goalCheckText}>✓</Text> : null}
              </View>
              <View style={styles.goalPrivacyCopy}>
                <Text style={styles.goalPrivacyTitle}>비공개로 도전하기</Text>
                <Text style={styles.goalPrivacyMeta}>
                  체크하면 원작자에게 목표 설정이 공유되지 않아요.
                </Text>
              </View>
            </Pressable>
            <View style={styles.goalModalActions}>
              <Pressable onPress={() => setGoalPost(null)} style={styles.goalModalCancel}>
                <Text style={styles.goalModalCancelText}>취소</Text>
              </Pressable>
              <Pressable onPress={createGoal} style={styles.goalModalSave}>
                <Text style={styles.goalModalSaveText}>목표로 저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeStory}
        statusBarTranslucent
        transparent
        visible={activeDemoStory !== null}
      >
        {activeDemoStory && selectedStoryOwner ? (
          <View style={styles.storyModalBackdrop}>
            <View style={styles.storyViewer}>
              <View style={styles.storyProgressRow}>
                {selectedStoryOwner.stories.map((story, index) => (
                  <View
                    key={story.id}
                    style={[
                      styles.storyProgressTrack,
                      index <= storyIndex && styles.storyProgressActive,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.storyViewerHeader}>
                <Pressable
                  accessibilityHint="작성자의 공개 프로필을 엽니다"
                  accessibilityLabel={`${selectedStoryOwner.name} 프로필 보기`}
                  accessibilityRole="button"
                  onPress={() => openMemberProfile(selectedStoryOwner.profileUserId)}
                  style={styles.storyViewerIdentity}
                >
                  <View style={styles.storyViewerAvatar}>
                    <Text style={styles.storyViewerAvatarText}>{selectedStoryOwner.icon}</Text>
                  </View>
                  <View>
                    <Text style={styles.storyViewerName}>{selectedStoryOwner.name}</Text>
                    <Text style={styles.storyViewerMeta}>
                      방금 전 · {storyIndex + 1}/{selectedStoryOwner.stories.length}
                    </Text>
                  </View>
                  <Text style={styles.storyViewerProfileHint}>프로필 ›</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="스토리 닫기"
                  accessibilityRole="button"
                  onPress={closeStory}
                  style={styles.storyViewerClose}
                >
                  <Text style={styles.storyViewerCloseText}>×</Text>
                </Pressable>
              </View>

              <View
                onLayout={(event) => setStoryCanvasWidth(event.nativeEvent.layout.width)}
                style={styles.storyCanvasTouchArea}
              >
                <StoryCanvas
                  background={activeDemoStory.background}
                  colors={colors}
                  customText={activeDemoStory.customText}
                  distance={activeDemoStory.distance}
                  distanceUnit={activeDemoStory.distanceUnit}
                  duration={activeDemoStory.duration}
                  height={540}
                  layout={activeDemoStory.layout}
                  layers={["record", "route", "text", "points"]}
                  moveScore={activeDemoStory.points}
                  pace={activeDemoStory.pace}
                  {...(activeDemoStory.photo ? { photoSource: activeDemoStory.photo } : {})}
                  photoUri={null}
                  routePoints={activeDemoStory.routePoints}
                  sportLabel={sportLabels[activeDemoStory.sport]}
                  themeLabel={activeDemoStory.themeLabel}
                  visibility={{
                    distance: true,
                    duration: true,
                    pace: true,
                    route: true,
                    points: true,
                  }}
                />
                <View style={styles.storyTapZones}>
                  <Pressable
                    accessibilityLabel="스토리 화면, 왼쪽은 이전, 오른쪽은 다음"
                    accessibilityRole="button"
                    onPress={(event) => {
                      const webOffsetX = (event.nativeEvent as unknown as { offsetX?: unknown })
                        .offsetX;
                      const tapX =
                        typeof event.nativeEvent.locationX === "number"
                          ? event.nativeEvent.locationX
                          : typeof webOffsetX === "number"
                            ? webOffsetX
                            : storyCanvasWidth;
                      if (tapX < storyCanvasWidth / 2) {
                        showPreviousStory();
                      } else {
                        showNextStory();
                      }
                    }}
                    style={styles.storyTapZone}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      <ScrollView
        {...storyPanResponder.panHandlers}
        contentContainerStyle={styles.stories}
        horizontal
        onScroll={(event) => {
          storyScrollOffsetRef.current = event.nativeEvent.contentOffset.x;
        }}
        ref={storyScrollRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.storyScroller}
        testID="story-owner-strip"
      >
        {storyOwners.map((owner, index) => {
          const selected = selectedStoryOwnerId === owner.id;
          return (
            <Pressable
              accessibilityLabel={`${owner.name} 스토리 ${owner.stories.length}개 열기`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={owner.id}
              onPress={() => openStory(owner.id)}
              style={styles.story}
            >
              <View style={[styles.storyRing, selected && styles.storyRingSelected]}>
                <View style={[styles.storyAvatar, index === 0 && styles.myStory]}>
                  <Text style={[styles.storyInitial, index === 0 && styles.myStoryText]}>
                    {owner.icon}
                  </Text>
                </View>
                <View style={styles.storyCountBadge}>
                  <Text style={styles.storyCountText}>{owner.stories.length}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.storyName}>
                {owner.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
          <Pressable
            accessibilityLabel="사진 촬영"
            accessibilityRole="button"
            disabled={mediaBusy}
            onPress={() => void pickComposerMedia("camera")}
            style={styles.composerAction}
          >
            <Camera color={colors.muted} size={20} strokeWidth={2} />
            <Text style={styles.composerActionLabel}>사진</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="갤러리에서 사진 선택"
            accessibilityRole="button"
            disabled={mediaBusy}
            onPress={() => void pickComposerMedia("library")}
            style={styles.composerAction}
          >
            <ImageIcon color={colors.muted} size={20} strokeWidth={2} />
            <Text style={styles.composerActionLabel}>갤러리</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="오늘의 운동 기록 가져오기"
            accessibilityRole="button"
            onPress={() => {
              setComposerOpen(true);
              setWorkoutPickerOpen((current) => !current);
            }}
            style={styles.composerAction}
          >
            <BarChart3 color={colors.muted} size={20} strokeWidth={2} />
            <Text style={styles.composerActionLabel}>기록</Text>
          </Pressable>
        </View>
        {composerOpen && session ? (
          <View style={styles.composerForm}>
            {workoutPickerOpen ? (
              <View style={styles.workoutPickerPanel}>
                <Text style={styles.workoutPickerTitle}>오늘의 활동 기록</Text>
                {todayWorkoutOptions.length ? (
                  <View style={styles.workoutPickerList}>
                    {todayWorkoutOptions.map((workout) => (
                      <Pressable
                        accessibilityRole="button"
                        key={workout.id}
                        onPress={() => applyWorkoutToComposer(workout)}
                        style={styles.workoutPickerItem}
                      >
                        <View>
                          <Text style={styles.workoutPickerSport}>
                            {sportLabels[workout.sport]}
                          </Text>
                          <Text numberOfLines={1} style={styles.workoutPickerNote}>
                            {workout.notes ?? "오늘의 운동"}
                          </Text>
                        </View>
                        <Text style={styles.workoutPickerMetric}>{workoutListMetric(workout)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.workoutPickerEmpty}>아직 오늘의 기록이 없습니다.</Text>
                )}
              </View>
            ) : null}
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
            {extractHashtags(content).length ? (
              <View style={styles.composerHashtags}>
                {extractHashtags(content).map((tag) => (
                  <Text key={tag} style={styles.composerHashtag}>
                    #{tag}
                  </Text>
                ))}
              </View>
            ) : null}
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
      <View style={styles.hashtagSearchRow}>
        <TextInput
          accessibilityLabel="해시태그 검색"
          autoCapitalize="none"
          onChangeText={(value) => {
            setHashtagSearch(value);
            if (!value.trim()) setActiveHashtag(null);
          }}
          onSubmitEditing={() =>
            setActiveHashtag(hashtagSearch.trim().replace(/^#/, "").toLowerCase() || null)
          }
          placeholder="#해시태그 검색"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.hashtagSearchInput}
          value={hashtagSearch}
        />
        {normalizedHashtag ? (
          <Pressable
            onPress={() => {
              setActiveHashtag(null);
              setHashtagSearch("");
            }}
            style={styles.hashtagClear}
          >
            <Text style={styles.hashtagClearText}>전체</Text>
          </Pressable>
        ) : null}
      </View>
      {normalizedHashtag ? (
        <Text style={styles.hashtagResult}>#{normalizedHashtag} 피드만 보기</Text>
      ) : null}
      {loading ? <StatePanel state="loading" message="피드를 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {posts?.length === 0 ? <StatePanel state="empty" message="첫 기록을 공유해 보세요." /> : null}
      {visiblePosts?.map((post) => {
        const cheered = cheeredPosts.includes(post.id);
        const commentsOpen = openComments.includes(post.id);
        const bookmarked = bookmarkedPosts.includes(post.id);
        return (
          <View key={post.id} style={styles.post}>
            <View style={styles.postHeader}>
              <Pressable
                accessibilityLabel={`${post.authorDisplayName} 프로필 보기`}
                accessibilityRole="button"
                onPress={() => openMemberProfile(post.userId)}
                style={styles.authorRow}
              >
                <View style={styles.authorAvatar}>
                  <Text style={styles.authorInitial}>{post.authorDisplayName.slice(0, 1)}</Text>
                </View>
                <Text style={styles.author}>{post.authorDisplayName}</Text>
              </Pressable>
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
                <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
              </View>
            </View>
            <ImageBackground
              accessibilityLabel={`${sportLabels[post.sport]} 운동 기록 사진`}
              imageStyle={styles.feedArtworkImage}
              source={feedRunImage}
              style={styles.feedArtwork}
            >
              <LinearGradient
                colors={gradients.imageOverlay.colors}
                end={gradients.imageOverlay.end}
                start={gradients.imageOverlay.start}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.feedArtworkBrand}>GROOV STORY</Text>
              <Text style={styles.feedArtworkSport}>{sportLabels[post.sport]}</Text>
              <Text style={styles.feedArtworkMeta}>SHARED TODAY</Text>
            </ImageBackground>
            <Text style={styles.postCopy}>
              {post.content.split(/(\s+)/).map((part, index) =>
                part.startsWith("#") && part.length > 1 ? (
                  <Text
                    key={`${post.id}-tag-${index}`}
                    onPress={() => {
                      const tag = part.replace(/^#/, "").replace(/[^0-9A-Za-zㄱ-힝_].*$/, "");
                      setActiveHashtag(tag.toLowerCase());
                      setHashtagSearch(`#${tag}`);
                    }}
                    style={styles.inlineHashtag}
                  >
                    {part}
                  </Text>
                ) : (
                  part
                ),
              )}
            </Text>
            <View style={styles.postActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(post.id, cheeredPosts, setCheeredPosts)}
                style={styles.action}
              >
                <Heart
                  color={cheered ? colors.primary : colors.ink}
                  fill={cheered ? colors.primary : "transparent"}
                  size={20}
                  strokeWidth={2}
                />
                <Text style={[styles.actionCount, cheered && styles.activeAction]}>
                  {cheered ? 43 : 42}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(post.id, openComments, setOpenComments)}
                style={styles.action}
              >
                <MessageCircle color={colors.ink} size={20} strokeWidth={2} />
                <Text style={styles.actionCount}>{post.comments.length}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void shareWithFollowing(post.id)}
                style={styles.action}
              >
                <Send color={colors.ink} size={20} strokeWidth={2} />
                <Text style={styles.actionCount}>
                  {sharedCounts[post.id] ?? post.shareCount ?? 0}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="이 기록을 존중하고 목표로 설정"
                accessibilityRole="button"
                onPress={() => {
                  setGoalPrivate(false);
                  setGoalPost(post);
                }}
                style={styles.bookmark}
              >
                <Bookmark
                  color={bookmarked ? colors.primary : colors.ink}
                  fill={bookmarked ? colors.primarySoft : "transparent"}
                  size={20}
                  strokeWidth={2}
                />
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
                <View style={styles.commentComposer}>
                  <TextInput
                    accessibilityLabel="댓글 입력"
                    maxLength={500}
                    onChangeText={(value) =>
                      setCommentDrafts((current) => ({ ...current, [post.id]: value }))
                    }
                    onSubmitEditing={() => void submitComment(post.id)}
                    placeholder="응원과 정보를 나눠보세요"
                    placeholderTextColor={colors.muted}
                    returnKeyType="send"
                    style={styles.commentInput}
                    value={commentDrafts[post.id] ?? ""}
                  />
                  <Pressable
                    disabled={!commentDrafts[post.id]?.trim() || commentBusyIds.includes(post.id)}
                    onPress={() => void submitComment(post.id)}
                    style={styles.commentSubmit}
                  >
                    <Text style={styles.commentSubmitText}>
                      {commentBusyIds.includes(post.id) ? "…" : "등록"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const defaultStoryLayers: StoryLayer[] = ["record", "route", "points"];

function demoStory(
  sport: SportType,
  background: StoryBackground,
  themeLabel: string,
  customText: string,
  distance: string,
  distanceUnit: string,
  duration: string,
  pace: string,
  points: number,
  routePoints: MapPoint[],
  photo?: ImageSourcePropType,
): DemoStory {
  return {
    id: `demo-${sport}`,
    sport,
    background,
    ...(photo ? { photo } : {}),
    themeLabel,
    customText,
    distance,
    distanceUnit,
    duration,
    layout:
      sport === "hiking" || sport === "swimming"
        ? "centered"
        : sport === "cycling" || sport === "diving"
          ? "split"
          : sport === "strength"
            ? "low"
            : "editorial",
    pace,
    points,
    routePoints,
  };
}

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

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPace(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--'--\"";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}'${String(seconds).padStart(2, "0")}"`;
}

function workoutListMetric(workout: WorkoutSession) {
  if (workout.sport === "strength") {
    return `${Math.round(Number(workout.metrics.exerciseCount ?? 0))}종목`;
  }
  if (workout.sport === "diving") {
    return `${Number(workout.metrics.maxDepthM ?? 0).toFixed(1)}m`;
  }
  if (workout.sport === "swimming") {
    return `${Math.round(Number(workout.metrics.distanceM ?? 0))}m`;
  }
  return `${Number(workout.metrics.distanceKm ?? 0).toFixed(2)}km`;
}

function extractHashtags(value: string) {
  const matches = value.match(/#[0-9A-Za-zㄱ-힝_]+/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function relativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (elapsedSeconds < 60) return "방금";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}분 전`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3600)}시간 전`;
  return `${Math.floor(elapsedSeconds / 86_400)}일 전`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pageTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.bold },
    notice: { color: colors.primary, fontSize: 11, fontFamily: fonts.medium, marginTop: -9 },
    feedNotice: {
      color: colors.ink,
      fontSize: 10,
      lineHeight: 16,
      fontFamily: fonts.semibold,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    goalModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    goalModalCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      gap: 12,
    },
    goalModalEyebrow: { color: colors.primary, fontSize: 8, fontFamily: fonts.bold },
    goalModalTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.displayExtra },
    goalModalCopy: { color: colors.muted, fontSize: 11, lineHeight: 18 },
    goalPrivacyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
    },
    goalCheck: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    goalCheckActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    goalCheckText: { color: "#FFFFFF", fontSize: 12, fontFamily: fonts.bold },
    goalPrivacyCopy: { flex: 1 },
    goalPrivacyTitle: { color: colors.ink, fontSize: 11, fontFamily: fonts.bold },
    goalPrivacyMeta: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 2 },
    goalModalActions: { flexDirection: "row", gap: 8 },
    goalModalCancel: {
      minWidth: 74,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    goalModalCancelText: { color: colors.muted, fontSize: 10, fontFamily: fonts.bold },
    goalModalSave: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    goalModalSaveText: { color: "#FFFFFF", fontSize: 10, fontFamily: fonts.bold },
    storyScroller: { width: "100%" },
    stories: { gap: space[4], paddingVertical: 3, paddingRight: space[4] },
    story: { width: 56, alignItems: "center", gap: space[2] },
    storyRing: {
      width: 48,
      height: 48,
      borderRadius: radius.full,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    storyRingSelected: { borderColor: colors.primary },
    storyAvatar: {
      width: 39,
      height: 39,
      borderRadius: radius.full,
      backgroundColor: colors.hero,
      alignItems: "center",
      justifyContent: "center",
    },
    myStory: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    storyInitial: { color: "#FFFFFF", fontSize: 15, fontFamily: fonts.bold },
    myStoryText: { color: colors.primary, fontSize: 22, fontFamily: fonts.regular },
    storyName: { color: colors.ink, fontSize: 10, fontFamily: fonts.regular },
    storyCountBadge: {
      position: "absolute",
      right: -5,
      bottom: -3,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 4,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.surface,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    storyCountText: { color: "#FFFFFF", fontSize: 7, fontFamily: fonts.bold },
    storyModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(5,5,6,0.96)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 18,
    },
    storyViewer: { width: "100%", maxWidth: 420, gap: 10 },
    storyProgressRow: { flexDirection: "row", gap: 4 },
    storyProgressTrack: {
      flex: 1,
      height: 3,
      borderRadius: radius.full,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    storyProgressActive: { backgroundColor: "#FFFFFF" },
    storyViewerHeader: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    storyViewerIdentity: { flexDirection: "row", alignItems: "center", gap: 9 },
    storyViewerAvatar: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: "#1B1B1D",
      alignItems: "center",
      justifyContent: "center",
    },
    storyViewerAvatarText: { color: "#FFFFFF", fontSize: 11, fontFamily: fonts.bold },
    storyViewerName: { color: "#FFFFFF", fontSize: 12, fontFamily: fonts.bold },
    storyViewerMeta: {
      color: "rgba(255,255,255,0.52)",
      fontSize: 8,
      fontFamily: fonts.medium,
      marginTop: 2,
    },
    storyViewerProfileHint: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 8,
      fontFamily: fonts.semibold,
      marginLeft: 2,
    },
    storyViewerClose: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      borderWidth: 0,
      outlineWidth: 0,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    storyViewerCloseText: {
      color: "#FFFFFF",
      fontSize: 30,
      lineHeight: 32,
      fontFamily: fonts.regular,
    },
    storyCanvasTouchArea: { position: "relative", borderRadius: 14, overflow: "hidden" },
    storyTapZones: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      flexDirection: "row",
    },
    storyTapZone: {
      flex: 1,
      borderWidth: 0,
      outlineWidth: 0,
      backgroundColor: "transparent",
    },
    composer: { padding: 0, overflow: "hidden" },
    composerPrompt: {
      minHeight: 57,
      flexDirection: "row",
      alignItems: "center",
      gap: space[3],
      paddingHorizontal: space[4],
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    miniAvatarText: { color: colors.ink, fontSize: 10, fontFamily: fonts.bold },
    composerPromptText: { color: colors.muted, fontSize: 12, fontFamily: fonts.regular },
    composerActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
    composerAction: {
      flex: 1,
      minHeight: 54,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    composerActionLabel: { color: colors.muted, fontSize: 7, fontFamily: fonts.semibold },
    composerForm: { padding: space[4], borderTopWidth: 1, borderTopColor: colors.border },
    workoutPickerPanel: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 9,
      marginBottom: 10,
    },
    workoutPickerTitle: { color: colors.ink, fontSize: 11, fontFamily: fonts.bold },
    workoutPickerList: { gap: 7 },
    workoutPickerItem: {
      minHeight: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      paddingHorizontal: 11,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    workoutPickerSport: { color: colors.primary, fontSize: 8, fontFamily: fonts.bold },
    workoutPickerNote: {
      color: colors.ink,
      fontSize: 9,
      fontFamily: fonts.medium,
      marginTop: 2,
      maxWidth: 235,
    },
    workoutPickerMetric: { color: colors.ink, fontSize: 13, fontFamily: fonts.displayExtra },
    workoutPickerEmpty: {
      color: colors.muted,
      fontSize: 10,
      fontFamily: fonts.medium,
      paddingVertical: 12,
      textAlign: "center",
    },
    sportPicker: { flexDirection: "row", gap: 6, paddingBottom: 9 },
    sportChip: {
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceMuted,
    },
    sportChipActive: { backgroundColor: colors.primary },
    sportChipText: { color: colors.muted, fontSize: 10, fontFamily: fonts.semibold },
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
      borderRadius: radius.md,
      padding: 10,
      textAlignVertical: "top",
      marginBottom: 9,
    },
    composerHashtags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
    composerHashtag: { color: colors.primary, fontSize: 11, fontFamily: fonts.bold },
    error: { color: colors.danger, fontSize: 10, marginBottom: 8 },
    sectionTitle: { color: colors.ink, fontSize: 17, fontFamily: fonts.bold },
    hashtagSearchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    hashtagSearchInput: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.ink,
      paddingHorizontal: 12,
      fontSize: 11,
    },
    hashtagClear: {
      minHeight: 42,
      paddingHorizontal: 13,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    hashtagClearText: { color: colors.ink, fontSize: 10, fontFamily: fonts.bold },
    hashtagResult: { color: colors.primary, fontSize: 10, fontFamily: fonts.bold },
    post: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[5] },
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
    authorInitial: { color: colors.primary, fontSize: 11, fontFamily: fonts.bold },
    author: { color: colors.ink, fontSize: 13, fontFamily: fonts.semibold },
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
    followText: { color: "#FFFFFF", fontSize: 9, fontFamily: fonts.bold },
    followTextActive: { color: colors.ink },
    time: { color: colors.muted, fontSize: 10, fontFamily: fonts.regular },
    feedArtwork: {
      height: 288,
      borderRadius: radius["2xl"],
      overflow: "hidden",
      backgroundColor: colors.hero,
      padding: space[5],
      justifyContent: "flex-end",
    },
    feedArtworkImage: { borderRadius: radius["2xl"] },
    feedArtworkBrand: {
      position: "absolute",
      left: space[5],
      top: space[5],
      color: colors.primary,
      fontSize: 9,
      fontFamily: fonts.bold,
      letterSpacing: 1.2,
    },
    feedArtworkSport: { color: "#FFFFFF", fontSize: 30, fontFamily: fonts.bold },
    feedArtworkMeta: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 8,
      fontFamily: fonts.bold,
      letterSpacing: 1.3,
      marginTop: 5,
    },
    postCopy: {
      color: colors.ink,
      fontSize: 13,
      fontFamily: fonts.regular,
      lineHeight: 21,
      marginTop: 12,
    },
    inlineHashtag: { color: colors.primary, fontFamily: fonts.semibold },
    postActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
    action: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6 },
    actionCount: { color: colors.ink, fontSize: 12, fontFamily: fonts.medium },
    activeAction: { color: colors.primary },
    bookmark: { minHeight: 30, justifyContent: "center", marginLeft: "auto" },
    comments: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 7 },
    comment: { color: colors.ink, fontSize: 11, lineHeight: 17 },
    commentAuthor: { fontWeight: "900" },
    emptyComment: { color: colors.muted, fontSize: 10 },
    commentComposer: { flexDirection: "row", gap: 7, marginTop: 4 },
    commentInput: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.ink,
      paddingHorizontal: 11,
      fontSize: 10,
    },
    commentSubmit: {
      minWidth: 56,
      minHeight: 40,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    commentSubmitText: { color: "#FFFFFF", fontSize: 10, fontFamily: fonts.bold },
  });
}
