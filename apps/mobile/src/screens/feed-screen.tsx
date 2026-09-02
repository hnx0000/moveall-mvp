import {
  sportLabels,
  sportValues,
  type FeedPost,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  BarChart3,
  Bookmark,
  Camera,
  Heart,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import storyDiveDepth from "../../assets/images/instagram/story-dive-depth.jpg";
import storyDiveGroup from "../../assets/images/instagram/story-dive-group.jpg";
import storyDiveLine from "../../assets/images/instagram/story-dive-line.jpg";
import storyPoolBlue from "../../assets/images/instagram/story-pool-blue.jpg";
import storyPoolLane from "../../assets/images/instagram/story-pool-lane.jpg";
import storyPoolSide from "../../assets/images/instagram/story-poolside.jpg";
import storyPoolSunset from "../../assets/images/instagram/story-pool-sunset.jpg";
import storyPoolSurface from "../../assets/images/instagram/story-pool-surface.jpg";
import harinStory01 from "../../assets/images/people/harin/story-01.jpg";
import harinStory02 from "../../assets/images/people/harin/story-02.jpg";
import harinStory03 from "../../assets/images/people/harin/story-03.jpg";
import jiyoungStory01 from "../../assets/images/people/jiyoung/story-01.jpg";
import minjiStory01 from "../../assets/images/people/minji/story-01.jpg";
import minjiStory02 from "../../assets/images/people/minji/story-02.jpg";
import seoaStory01 from "../../assets/images/people/seoa/story-01.jpg";
import seoaStory02 from "../../assets/images/people/seoa/story-02.jpg";
import taeoStory01 from "../../assets/images/people/taeo/story-01.jpg";
import yunaStory01 from "../../assets/images/people/yuna/story-01.jpg";
import { api } from "../../src/api/client";
import { TapShareSheet } from "../components/tap-share-sheet";
import { useAuth } from "../../src/auth/auth-context";
import { demoAvatarSources } from "../../src/demo-avatars";
import {
  BellButton,
  Card,
  CenterDialog,
  PrimaryButton,
  Screen,
  StatePanel,
} from "../../src/components/ui";
import {
  StoryCanvas,
  type StoryBackground,
  type StoryLayer,
  type StoryLayout,
  type StoryMetricKey,
  type StoryScale,
  type StoryVisibility,
} from "../../src/components/story-canvas";
import { type MapPoint } from "../../src/components/workout-map.types";
import { TapShareIcon } from "../../src/components/tap-icons";
import { saveRecordGoal } from "../../src/goals";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { uploadMediaAsset } from "../../src/media/upload";
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
    "ink",
    "BODY CHECK",
    "오늘의 눈바디.",
    "8",
    "MOVES",
    "52:00",
    "16 SET",
    684,
    [],
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
    storyPoolSurface,
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
    storyDiveDepth,
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
      {
        ...baseStories.swimming,
        id: "me-swimming-lane",
        photo: storyPoolLane,
        customText: "레인 위로 번지는 빛.",
      },
      {
        ...baseStories.swimming,
        id: "me-swimming-blue",
        photo: storyPoolBlue,
        layout: "split",
        customText: "오늘의 블루 세션.",
      },
      {
        ...baseStories.swimming,
        id: "me-swimming-side",
        photo: storyPoolSide,
        layout: "low",
        customText: "물에 들어가기 전.",
      },
      {
        ...baseStories.swimming,
        id: "me-swimming-sunset",
        photo: storyPoolSunset,
        layout: "editorial",
        customText: "노을 아래 마지막 랩.",
      },
      baseStories.diving,
      {
        ...baseStories.diving,
        id: "me-diving-line",
        photo: storyDiveLine,
        layout: "centered",
        customText: "라인을 따라 차분하게.",
      },
      {
        ...baseStories.diving,
        id: "me-diving-group",
        photo: storyDiveGroup,
        layout: "low",
        customText: "함께 내려간 블루 세션.",
      },
    ],
  },
  {
    id: "minji",
    profileUserId: "demo-friend-1",
    name: "민지",
    icon: "R",
    stories: [
      {
        ...baseStories.hiking,
        id: "minji-hiking",
        background: "photo",
        photo: minjiStory01,
        routePoints: [],
        customText: "정상에서 한 번 더 숨 고르기.",
      },
      {
        ...baseStories.hiking,
        id: "minji-sunset",
        background: "photo",
        layout: "low",
        photo: minjiStory02,
        routePoints: [],
        customText: "해가 지기 전 도착.",
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
        ...baseStories.diving,
        id: "yuna-diving",
        layout: "low",
        photo: yunaStory01,
        customText: "수면 아래에서 찾은 집중.",
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
        ...baseStories.hiking,
        id: "harin-hiking-rest",
        background: "photo",
        layout: "split",
        photo: harinStory01,
        routePoints: [],
        customText: "바위 위에서 잠깐 쉬기.",
      },
      {
        ...baseStories.hiking,
        id: "harin-hiking-trail",
        background: "photo",
        layout: "centered",
        photo: harinStory02,
        routePoints: [],
        customText: "오늘도 한 걸음 위로.",
      },
      {
        ...baseStories.running,
        id: "harin-running",
        background: "photo",
        layout: "low",
        photo: harinStory03,
        routePoints: [],
        customText: "가볍게 움직인 오후.",
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
        ...baseStories.strength,
        id: "taeo-strength",
        background: "photo",
        layout: "low",
        photo: taeoStory01,
        customText: "오늘의 상체 루틴 완료.",
      },
      { ...baseStories.hiking, id: "taeo-hiking", customText: "사진 없이 기록만 남긴 산행." },
    ],
  },
  {
    id: "seoa",
    profileUserId: "demo-friend-7",
    name: "서아",
    icon: "S",
    stories: [
      {
        ...baseStories.running,
        id: "seoa-running",
        background: "photo",
        layout: "editorial",
        photo: seoaStory01,
        routePoints: [],
        customText: "트랙 위에서 가볍게.",
      },
      {
        ...baseStories.strength,
        id: "seoa-strength",
        background: "photo",
        layout: "split",
        photo: seoaStory02,
        customText: "자세에 집중한 루틴.",
      },
    ],
  },
  {
    id: "jiyoung",
    profileUserId: "demo-friend-8",
    name: "지영",
    icon: "J",
    stories: [
      {
        ...baseStories.strength,
        id: "jiyoung-strength",
        background: "photo",
        layout: "editorial",
        photo: jiyoungStory01,
        customText: "오늘의 근력 루틴 완료.",
      },
    ],
  },
];

const feedImageSources: Partial<Record<string, ImageSourcePropType>> = {
  "demo-post-running": minjiStory01,
  "demo-post-swimming": yunaStory01,
  "demo-post-taeo": taeoStory01,
  "demo-post-seoa": seoaStory02,
  "demo-post-jiyoung": jiyoungStory01,
  "demo-post-harin": harinStory02,
};

export default function FeedScreen() {
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
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
    post?: string;
  }>();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const sharedPostId = typeof params.post === "string" ? params.post : null;
  const loader = useCallback(
    async () =>
      sharedPostId
        ? [await api.post(sharedPostId, session?.accessToken)]
        : api.feed(session?.accessToken),
    [session?.accessToken, sharedPostId],
  );
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
  const [shareTargetPost, setShareTargetPost] = useState<FeedPost | null>(null);
  const [feedNotice, setFeedNotice] = useState<string | null>(null);
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [goalPost, setGoalPost] = useState<FeedPost | null>(null);
  const [goalPrivate, setGoalPrivate] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followBusyIds, setFollowBusyIds] = useState<string[]>([]);
  const [currentAvatarUri, setCurrentAvatarUri] = useState<string | null>(() =>
    readPersistedCurrentAvatar(),
  );
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [draftPhotoAsset, setDraftPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [todayWorkoutOptions, setTodayWorkoutOptions] = useState<WorkoutSession[]>([]);
  const [workoutPickerOpen, setWorkoutPickerOpen] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [storyBackground, setStoryBackground] = useState<StoryBackground>("photo");
  const [storyLayers, setStoryLayers] = useState<StoryLayer[]>(["record", "route", "points"]);
  const [storyLayout, setStoryLayout] = useState<StoryLayout>("editorial");
  const [storyScale, setStoryScale] = useState<StoryScale>("standard");
  const [storyMetricOrder, setStoryMetricOrder] = useState<StoryMetricKey[]>([
    "distance",
    "duration",
    "pace",
  ]);
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
  const storyViewerMaxWidth = Math.min(420, Math.max(240, windowWidth - 28));
  const storyCanvasHeight = Math.max(
    0,
    Math.min(storyViewerMaxWidth * (16 / 9), windowHeight - 132),
  );
  const storyViewerWidth = storyCanvasHeight * (9 / 16);
  const avatarByUserId = useMemo(() => {
    const avatars = new Map<string, string>();
    if (session?.user.id && currentAvatarUri) avatars.set(session.user.id, currentAvatarUri);
    posts?.forEach((post) => {
      if (post.authorAvatarDataUri) avatars.set(post.userId, post.authorAvatarDataUri);
      post.comments.forEach((comment) => {
        if (comment.authorAvatarDataUri) avatars.set(comment.userId, comment.authorAvatarDataUri);
      });
    });
    return avatars;
  }, [currentAvatarUri, posts, session?.user.id]);

  const avatarSourceForUser = useCallback(
    (userId?: string): ImageSourcePropType | null => {
      const uri = userId ? avatarByUserId.get(userId) : currentAvatarUri;
      if (uri) return { uri };
      return userId ? (demoAvatarSources[userId] ?? null) : null;
    },
    [avatarByUserId, currentAvatarUri],
  );

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

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setCurrentAvatarUri(null);
        setFollowingIds([]);
        return undefined;
      }
      let active = true;
      const persistedAvatar = readPersistedCurrentAvatar();
      if (persistedAvatar) setCurrentAvatarUri(persistedAvatar);
      void api
        .profile(session.accessToken)
        .then((profile) => {
          if (active) setCurrentAvatarUri(profile.avatarDataUri ?? persistedAvatar);
        })
        .catch(() => {
          if (active) setCurrentAvatarUri(persistedAvatar);
        });
      void api
        .socialSummary(session.accessToken)
        .then((summary) => {
          if (active) setFollowingIds(summary.following.map((person) => person.id));
        })
        .catch(() => undefined);
      void reload();
      return () => {
        active = false;
      };
    }, [reload, session]),
  );

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
      if (Platform.OS !== "web") {
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
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({
              allowsMultipleSelection: false,
              mediaTypes: ["images"],
              quality: 0.9,
              selectionLimit: 1,
            });
      if (!result.canceled && result.assets[0]?.uri) {
        setDraftPhoto(result.assets[0].uri);
        setDraftPhotoAsset(result.assets[0]);
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
    setStoryLayout("editorial");
    setStoryScale("standard");
    setStoryMetricOrder(["distance", "duration", "pace"]);
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
      let mediaId: string | undefined;
      if (draftPhoto && process.env.EXPO_PUBLIC_LOGIN_REQUIRED === "true") {
        const source = await fetch(draftPhoto);
        const sourceBlob = await source.blob();
        const detectedType = draftPhotoAsset?.mimeType ?? sourceBlob.type;
        const contentType = (
          detectedType === "image/png" ||
          detectedType === "image/webp" ||
          detectedType === "image/jpeg"
            ? detectedType
            : "image/jpeg"
        ) as "image/jpeg" | "image/png" | "image/webp";
        const uploaded = await uploadMediaAsset({
          token: session.accessToken,
          uri: draftPhoto,
          kind: "post-image",
          contentType,
          byteSize: draftPhotoAsset?.fileSize ?? sourceBlob.size,
        });
        mediaId = uploaded.mediaId;
      }
      await api.createPost(session.accessToken, {
        sport,
        content: publicContent,
        ...(mediaId ? { mediaId } : {}),
        ...(typeof params.workoutSessionId === "string"
          ? { workoutSessionId: params.workoutSessionId }
          : {}),
      });
      setContent("");
      setDraftPhoto(null);
      setDraftPhotoAsset(null);
      setSelectedWorkoutId(null);
      setWorkoutPickerOpen(false);
      setStoryRoute([]);
      setStoryText("");
      setComposerOpen(false);
      router.replace("/");
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

  function reportContent(targetType: "post" | "comment", targetId: string) {
    if (!session) return;
    Alert.alert(
      targetType === "post" ? "게시물을 신고할까요?" : "댓글을 신고할까요?",
      "운영팀이 내용을 확인합니다. 반복 신고나 허위 신고는 제한될 수 있습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "신고",
          onPress: () => {
            void api
              .createReport(session.accessToken, {
                targetType,
                targetId,
                reason: "other",
                details: "앱 내 피드에서 신고됨",
              })
              .then(() => setFeedNotice("신고를 접수했습니다. 운영팀이 확인할게요."))
              .catch((caught) =>
                setFeedNotice(caught instanceof Error ? caught.message : "신고하지 못했습니다."),
              );
          },
        },
      ],
    );
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
    (post) =>
      sharedPostId ||
      !normalizedHashtag ||
      extractHashtags(post.content).includes(normalizedHashtag),
  );

  return (
    <Screen
      key={sharedPostId || "feed"}
      title=""
      action={
        <BellButton
          label="피드 알림 확인"
          onPress={() => setFeedNotice("오늘 확인할 새로운 피드 알림이 없습니다.")}
        />
      }
    >
      <CenterDialog
        message={feedNotice ?? ""}
        onClose={() => setFeedNotice(null)}
        title="안내"
        visible={feedNotice !== null}
      />

      {shareTargetPost ? (
        <TapShareSheet
          key={shareTargetPost.id}
          post={shareTargetPost}
          onClose={() => setShareTargetPost(null)}
          onShared={(result) =>
            setSharedCounts((current) => ({ ...current, [shareTargetPost.id]: result.shareCount }))
          }
          onNotice={setFeedNotice}
        />
      ) : null}

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
            <View style={[styles.storyViewer, { width: storyViewerWidth }]}>
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
                    {avatarSourceForUser(selectedStoryOwner.profileUserId) ? (
                      <Image
                        source={avatarSourceForUser(selectedStoryOwner.profileUserId)!}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.storyViewerAvatarText}>{selectedStoryOwner.icon}</Text>
                    )}
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
                  height={storyCanvasHeight}
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

      {!sharedPostId ? (
        <>
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
              const avatarSource = avatarSourceForUser(owner.profileUserId);
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
                      {avatarSource ? (
                        <Image source={avatarSource} style={styles.avatarImage} />
                      ) : (
                        <Text style={[styles.storyInitial, index === 0 && styles.myStoryText]}>
                          {owner.icon}
                        </Text>
                      )}
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
                {currentAvatarUri ? (
                  <Image source={{ uri: currentAvatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.miniAvatarText}>
                    {session?.user.displayName.slice(0, 1) ?? "M"}
                  </Text>
                )}
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
                            <Text style={styles.workoutPickerMetric}>
                              {workoutListMetric(workout)}
                            </Text>
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
                          style={[
                            styles.sportChipText,
                            sport === item && styles.sportChipTextActive,
                          ]}
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
                      layout={storyLayout}
                      metricOrder={storyMetricOrder}
                      moveScore={storyPoints}
                      pace={storyPace}
                      photoUri={draftPhoto}
                      routePoints={storyRoute}
                      scale={storyScale}
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
                  <View style={styles.storyEditor}>
                    <View style={styles.storyEditorHeading}>
                      <View>
                        <Text style={styles.storyEditorEyebrow}>RECORD CARD STUDIO</Text>
                        <Text style={styles.storyEditorTitle}>기록 카드 편집</Text>
                      </View>
                      <Text style={styles.storyEditorMeta}>게시 전 미리보기</Text>
                    </View>
                    <EditorControl
                      label="배치"
                      options={[
                        ["editorial", "에디토리얼"],
                        ["centered", "중앙"],
                        ["split", "분할"],
                        ["low", "하단"],
                      ]}
                      selected={storyLayout}
                      onSelect={(value) => setStoryLayout(value as StoryLayout)}
                      styles={styles}
                    />
                    <EditorControl
                      label="크기"
                      options={[
                        ["compact", "작게"],
                        ["standard", "기본"],
                        ["bold", "크게"],
                      ]}
                      selected={storyScale}
                      onSelect={(value) => setStoryScale(value as StoryScale)}
                      styles={styles}
                    />
                    <EditorControl
                      label="배경"
                      options={[
                        ["photo", "사진"],
                        ["map", "지도"],
                        ["ink", "잉크"],
                      ]}
                      selected={storyBackground}
                      onSelect={(value) => setStoryBackground(value as StoryBackground)}
                      styles={styles}
                    />
                    <View style={styles.storyOrderHeader}>
                      <Text style={styles.storyEditorLabel}>기록 정보 순서</Text>
                      <Text style={styles.storyEditorHint}>화살표로 위치 이동</Text>
                    </View>
                    <View style={styles.storyOrderList}>
                      {storyMetricOrder.map((key, index) => {
                        const labels: Record<StoryMetricKey, string> = {
                          distance: "거리",
                          duration: "시간",
                          pace: "페이스",
                        };
                        return (
                          <View key={key} style={styles.storyOrderItem}>
                            <Pressable
                              accessibilityRole="switch"
                              accessibilityState={{ checked: storyVisibility[key] }}
                              onPress={() => toggleStoryVisibility(key)}
                              style={[
                                styles.storyOrderToggle,
                                storyVisibility[key] && styles.storyOrderToggleActive,
                              ]}
                            >
                              <View
                                style={[
                                  styles.sharePrivacyDot,
                                  storyVisibility[key] && styles.sharePrivacyDotActive,
                                ]}
                              />
                              <Text style={styles.storyOrderText}>{labels[key]}</Text>
                            </Pressable>
                            <View style={styles.storyOrderActions}>
                              <Pressable
                                accessibilityLabel={`${labels[key]} 앞으로 이동`}
                                disabled={index === 0}
                                onPress={() =>
                                  setStoryMetricOrder((current) =>
                                    moveItem(current, index, index - 1),
                                  )
                                }
                                style={[
                                  styles.storyOrderButton,
                                  index === 0 && styles.disabledControl,
                                ]}
                              >
                                <Text style={styles.storyOrderButtonText}>←</Text>
                              </Pressable>
                              <Pressable
                                accessibilityLabel={`${labels[key]} 뒤로 이동`}
                                disabled={index === storyMetricOrder.length - 1}
                                onPress={() =>
                                  setStoryMetricOrder((current) =>
                                    moveItem(current, index, index + 1),
                                  )
                                }
                                style={[
                                  styles.storyOrderButton,
                                  index === storyMetricOrder.length - 1 && styles.disabledControl,
                                ]}
                              >
                                <Text style={styles.storyOrderButtonText}>→</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.storyEditorLabel}>추가 요소</Text>
                    <View style={styles.sharePrivacyRow}>
                      {(
                        [
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
        </>
      ) : null}
      <View>
        <Text style={styles.sectionEyebrow}>LATEST FEED</Text>
        <Text style={styles.sectionTitle}>{sharedPostId ? "공유된 피드" : "최신 피드"}</Text>
        {sharedPostId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.setParams({ post: "" });
              setActiveHashtag(null);
              setHashtagSearch("");
            }}
          >
            <Text style={styles.hashtagClearText}>전체 피드 보기 →</Text>
          </Pressable>
        ) : null}
      </View>
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
        const postAvatarSource = avatarSourceForUser(post.userId);
        const postImageSource = post.mediaUrl ? { uri: post.mediaUrl } : feedImageSources[post.id];
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
                  {postAvatarSource ? (
                    <Image source={postAvatarSource} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.authorInitial}>{post.authorDisplayName.slice(0, 1)}</Text>
                  )}
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
                {session?.user.id !== post.userId ? (
                  <Pressable
                    accessibilityLabel="게시물 신고"
                    accessibilityRole="button"
                    onPress={() => reportContent("post", post.id)}
                  >
                    <Text style={styles.reportText}>신고</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
              </View>
            </View>
            {postImageSource ? (
              <ImageBackground
                accessibilityLabel={`${sportLabels[post.sport]} 운동 기록 사진`}
                imageStyle={styles.feedArtworkImage}
                resizeMode="cover"
                source={postImageSource}
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
            ) : (
              <View
                accessibilityLabel={`${sportLabels[post.sport]} 사진 없는 운동 기록`}
                style={[styles.feedArtwork, styles.feedRecordArtwork]}
              >
                <Text style={styles.feedArtworkBrand}>GROOV RECORD</Text>
                <Text style={styles.feedArtworkSport}>{sportLabels[post.sport]}</Text>
                <Text style={styles.feedArtworkMeta}>VERIFIED ACTIVITY</Text>
              </View>
            )}
            <Text style={styles.postCopy}>
              {post.content.split(/(\s+)/).map((part, index) =>
                part.startsWith("#") && part.length > 1 ? (
                  <Text
                    key={`${post.id}-tag-${index}`}
                    onPress={() => {
                      const tag = part.replace(/^#/, "").replace(/[^0-9A-Za-zㄱ-힝_].*$/, "");
                      if (sharedPostId) router.setParams({ post: "" });
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
                accessibilityLabel="탭에 공유하기"
                accessibilityRole="button"
                onPress={() => {
                  setFeedNotice(null);
                  setShareTargetPost(post);
                }}
                style={styles.action}
              >
                <TapShareIcon color={colors.ink} size={24} strokeWidth={2.05} />
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
                  post.comments.map((comment) => {
                    const commentAvatarSource = avatarSourceForUser(comment.userId);
                    return (
                      <View key={comment.id} style={styles.commentRow}>
                        <Pressable
                          accessibilityLabel={`${comment.authorDisplayName} 프로필 보기`}
                          accessibilityRole="button"
                          onPress={() => openMemberProfile(comment.userId)}
                          style={styles.commentIdentity}
                        >
                          <View style={styles.commentAvatar}>
                            {commentAvatarSource ? (
                              <Image source={commentAvatarSource} style={styles.avatarImage} />
                            ) : (
                              <Text style={styles.commentAvatarText}>
                                {comment.authorDisplayName.slice(0, 1)}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.commentAuthor}>{comment.authorDisplayName}</Text>
                        </Pressable>
                        <View style={styles.commentContentRow}>
                          <Text style={styles.comment}>{comment.content}</Text>
                          {session?.user.id !== comment.userId ? (
                            <Pressable
                              accessibilityLabel="댓글 신고"
                              accessibilityRole="button"
                              onPress={() => reportContent("comment", comment.id)}
                            >
                              <Text style={styles.commentReportText}>신고</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
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

function EditorControl({
  label,
  options,
  selected,
  onSelect,
  styles,
}: {
  label: string;
  options: Array<[string, string]>;
  selected: string;
  onSelect: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.storyEditorControl}>
      <Text style={styles.storyEditorLabel}>{label}</Text>
      <View style={styles.storyEditorOptions}>
        {options.map(([value, optionLabel]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: value === selected }}
            key={value}
            onPress={() => onSelect(value)}
            style={[styles.storyEditorOption, value === selected && styles.storyEditorOptionActive]}
          >
            <Text
              style={[
                styles.storyEditorOptionText,
                value === selected && styles.storyEditorOptionTextActive,
              ]}
            >
              {optionLabel}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(to, 0, moved);
  return next;
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

function readPersistedCurrentAvatar(): string | null {
  try {
    if (!("localStorage" in globalThis)) return null;
    return globalThis.localStorage.getItem("groov-demo-avatar-v1");
  } catch {
    return null;
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    avatarImage: { width: "100%", height: "100%", borderRadius: radius.full },
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
    storyEditor: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 11,
      marginBottom: 11,
      gap: 12,
    },
    storyEditorHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    storyEditorEyebrow: {
      color: colors.primary,
      fontSize: 7,
      fontFamily: fonts.bold,
      letterSpacing: 0.9,
    },
    storyEditorTitle: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold, marginTop: 2 },
    storyEditorMeta: { color: colors.muted, fontSize: 8 },
    storyEditorControl: { gap: 6 },
    storyEditorLabel: { color: colors.ink, fontSize: 9, fontFamily: fonts.bold },
    storyEditorHint: { color: colors.muted, fontSize: 7 },
    storyEditorOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    storyEditorOption: {
      minHeight: 30,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    storyEditorOptionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    storyEditorOptionText: { color: colors.muted, fontSize: 8, fontFamily: fonts.bold },
    storyEditorOptionTextActive: { color: colors.background },
    storyOrderHeader: { flexDirection: "row", justifyContent: "space-between" },
    storyOrderList: { gap: 6 },
    storyOrderItem: {
      minHeight: 38,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 9,
    },
    storyOrderToggle: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 38 },
    storyOrderToggleActive: { opacity: 1 },
    storyOrderText: { color: colors.ink, fontSize: 9, fontFamily: fonts.bold },
    storyOrderActions: { flexDirection: "row", gap: 5 },
    storyOrderButton: {
      width: 29,
      height: 27,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    storyOrderButtonText: { color: colors.ink, fontSize: 12, fontFamily: fonts.bold },
    disabledControl: { opacity: 0.25 },
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
    sectionEyebrow: {
      color: colors.primary,
      fontSize: 8,
      fontFamily: fonts.bold,
      letterSpacing: 1,
      marginBottom: 4,
    },
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
    reportText: { color: colors.muted, fontSize: 9, fontFamily: fonts.medium },
    time: { color: colors.muted, fontSize: 10, fontFamily: fonts.regular },
    feedArtwork: {
      width: "100%",
      aspectRatio: 4 / 5,
      borderRadius: radius["2xl"],
      overflow: "hidden",
      backgroundColor: colors.hero,
      padding: space[5],
      justifyContent: "flex-end",
    },
    feedArtworkImage: {
      width: "100%",
      height: "100%",
      borderRadius: radius["2xl"],
    },
    feedRecordArtwork: {
      aspectRatio: 16 / 9,
      backgroundColor: colors.hero,
      borderWidth: 1,
      borderColor: colors.border,
    },
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
    commentRow: { gap: 5 },
    commentIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "flex-start",
    },
    commentAvatar: {
      width: 25,
      height: 25,
      borderRadius: radius.full,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    commentAvatarText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    commentContentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingLeft: 32 },
    comment: { color: colors.ink, flex: 1, fontSize: 11, lineHeight: 17 },
    commentReportText: { color: colors.muted, fontSize: 9, lineHeight: 17 },
    commentAuthor: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
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
