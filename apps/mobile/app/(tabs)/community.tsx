import { sportLabels, sportValues, type SportType } from "@moveall/contracts";
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
          {[ImageIcon, BarChart3, Camera].map((ComposerIcon, index) => (
            <Pressable
              accessibilityLabel={["사진 추가", "운동 기록 추가", "카메라 열기"][index]}
              accessibilityRole="button"
              key={index}
              onPress={() => setComposerOpen(true)}
              style={styles.composerAction}
            >
              <ComposerIcon color={colors.muted} size={20} strokeWidth={2} />
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
                <Text style={styles.time}>2시간 전</Text>
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
            <Text style={styles.postCopy}>{post.content}</Text>
            <Text style={styles.tags}>#아침러닝 #이지런 #완주</Text>
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
                onPress={() => setComposerOpen(true)}
                style={styles.action}
              >
                <Send color={colors.ink} size={20} strokeWidth={2} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(post.id, bookmarkedPosts, setBookmarkedPosts)}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pageTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.bold },
    notice: { color: colors.primary, fontSize: 11, fontFamily: fonts.medium, marginTop: -9 },
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
    composerAction: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" },
    composerForm: { padding: space[4], borderTopWidth: 1, borderTopColor: colors.border },
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
    error: { color: colors.danger, fontSize: 10, marginBottom: 8 },
    sectionTitle: { color: colors.ink, fontSize: 17, fontFamily: fonts.bold },
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
    tags: { color: colors.primary, fontSize: 12, fontFamily: fonts.semibold, marginTop: 6 },
    postActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
    action: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6 },
    actionCount: { color: colors.ink, fontSize: 12, fontFamily: fonts.medium },
    activeAction: { color: colors.primary },
    bookmark: { minHeight: 30, justifyContent: "center", marginLeft: "auto" },
    comments: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 5 },
    comment: { color: colors.ink, fontSize: 11, lineHeight: 17 },
    commentAuthor: { fontWeight: "900" },
    emptyComment: { color: colors.muted, fontSize: 10 },
  });
}
