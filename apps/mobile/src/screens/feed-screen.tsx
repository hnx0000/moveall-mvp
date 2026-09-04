import { sportLabels, storyIsActive, type FeedPost, type SportType } from "@moveall/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Bookmark, Heart, MessageCircle, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
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
import { api, usePreviewApi } from "../../src/api/client";
import { TapShareSheet } from "../components/tap-share-sheet";
import { UnfollowDialog } from "../components/unfollow-dialog";
import { PostComments } from "../components/post-comments";
import { useAuth } from "../../src/auth/auth-context";
import { demoAvatarSources } from "../../src/demo-avatars";
import { CenterDialog, Screen, StatePanel } from "../../src/components/ui";
import { NotificationBell } from "../components/notification-bell";
import {
  StoryCanvas,
  type StoryBackground,
  type StoryLayout,
} from "../../src/components/story-canvas";
import { type MapPoint } from "../../src/components/workout-map.types";
import { WorkoutMap } from "../../src/components/workout-map";
import { RouteTrace } from "../../src/components/route-trace";
import { TapShareIcon } from "../../src/components/tap-icons";
import { saveRecordGoal } from "../../src/goals";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { PostArtwork } from "../components/post-artwork";
import { FeedLikeSurface } from "../components/feed-like-surface";
import {
  feedPostHref,
  hasFeedVisual,
  isRecordedFeedPost,
  rankHomeFeed,
} from "../components/feed-ranking";
import { fonts, gradients, radius, space, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type DemoStory = {
  id: string;
  post?: FeedPost;
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
  { latitude: 37.5208, longitude: 126.9971 },
  { latitude: 37.5215, longitude: 127.0015 },
  { latitude: 37.5211, longitude: 127.0054 },
  { latitude: 37.5196, longitude: 127.0098 },
  { latitude: 37.5182, longitude: 127.0137 },
  { latitude: 37.5168, longitude: 127.0172 },
  { latitude: 37.5173, longitude: 127.0211 },
  { latitude: 37.5191, longitude: 127.0248 },
  { latitude: 37.5207, longitude: 127.0282 },
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

const demoStoryOwners: StoryOwner[] = [
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
  "demo-post-swim-feed": storyPoolLane,
};

type FeedPresentation =
  | "photo-only"
  | "photo-record-overlay"
  | "photo-route-overlay"
  | "route-only"
  | "record-only"
  | "photo-separate-record";

const feedPresentations: Record<string, FeedPresentation> = {
  "demo-post-running": "photo-only",
  "demo-post-cycling": "route-only",
  "demo-post-strength": "record-only",
  "demo-post-taeo": "photo-separate-record",
  "demo-post-jiyoung": "photo-record-overlay",
  "demo-post-swim-feed": "photo-record-overlay",
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
    comments?: string;
  }>();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const sharedPostId = typeof params.post === "string" ? params.post : null;
  const [timeTick, updateRelativeTimes] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => updateRelativeTimes((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  const loader = useCallback(
    async () =>
      sharedPostId
        ? [await api.post(sharedPostId, session?.accessToken)]
        : api.feed(session?.accessToken),
    [session?.accessToken, sharedPostId],
  );
  const { data: posts, setData: setPosts, error, loading, reload } = useAsyncData(loader);
  const storyOwners = useMemo(() => {
    const ownId = session?.user.id;
    const owners: StoryOwner[] = [
      {
        id: "me",
        ...(ownId ? { profileUserId: ownId } : {}),
        name: "내 스토리",
        icon: "M",
        stories: [],
      },
    ];
    for (const post of posts ?? []) {
      if (post.contentType !== "story" || !storyIsActive(post)) continue;
      let owner = owners.find((entry) => entry.profileUserId === post.userId);
      if (!owner) {
        owner = {
          id: post.userId,
          profileUserId: post.userId,
          name: post.authorDisplayName,
          icon: post.authorDisplayName.slice(0, 1),
          stories: [],
        };
        owners.push(owner);
      }
      owner.stories.push({ ...baseStories[post.sport], id: post.id, post });
    }
    if (usePreviewApi) {
      for (const owner of demoStoryOwners) {
        if (
          !owner.profileUserId ||
          owners.some((entry) => entry.profileUserId === owner.profileUserId)
        )
          continue;
        if (posts?.some((post) => post.userId === owner.profileUserId)) owners.push(owner);
      }
    }
    return owners;
    // Re-evaluate expiry even when the feed remains open.
  }, [posts, session?.user.id, timeTick]);
  const forwardedDraft = useRef<string | null>(null);
  useEffect(() => {
    if (!params.workoutSessionId && !params.photo && !params.draft) return;
    const key = JSON.stringify([params.workoutSessionId, params.photo, params.draft]);
    if (forwardedDraft.current === key) return;
    forwardedDraft.current = key;
    router.setParams({ workoutSessionId: "", photo: "", draft: "" });
    router.push({
      pathname: "/compose",
      params: {
        ...(params.workoutSessionId ? { workoutSessionId: params.workoutSessionId } : {}),
        ...(params.photo ? { photo: params.photo } : {}),
        ...(params.draft ? { draft: params.draft } : {}),
      },
    });
  }, [params.workoutSessionId, params.photo, params.draft, router]);
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
  const likeRequests = useRef(new Set<string>());
  const [openComments, setOpenComments] = useState<string[]>([]);
  useEffect(() => {
    if (sharedPostId && params.comments === "1")
      setOpenComments((current) => [...new Set([...current, sharedPostId])]);
  }, [sharedPostId, params.comments]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<string[]>([]);
  const [deleteTargetPost, setDeleteTargetPost] = useState<FeedPost | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const deleteBusyRef = useRef(false);
  const [sharedCounts, setSharedCounts] = useState<Record<string, number>>({});
  const [shareTargetPost, setShareTargetPost] = useState<FeedPost | null>(null);
  const [feedNotice, setFeedNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshBusyRef = useRef(false);
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [feedLayout, setFeedLayout] = useState<"cards" | "grid">("cards");
  const [goalPost, setGoalPost] = useState<FeedPost | null>(null);
  const [goalPrivate, setGoalPrivate] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [unfollowTargetId, setUnfollowTargetId] = useState<string | null>(null);
  const followRequests = useRef(new Set<string>());
  const [followBusyIds, setFollowBusyIds] = useState<string[]>([]);
  const [currentAvatarUri, setCurrentAvatarUri] = useState<string | null>(() =>
    readPersistedCurrentAvatar(),
  );
  const refreshFeed = useCallback(async () => {
    if (refreshBusyRef.current) return;
    refreshBusyRef.current = true;
    setRefreshing(true);
    try {
      const requests: Promise<unknown>[] = [
        reload().then((success) => {
          if (!success) throw new Error("피드를 불러오지 못했습니다.");
          setSharedCounts({});
        }),
      ];
      if (session) {
        requests.push(
          api
            .profile(session.accessToken)
            .then((profile) =>
              setCurrentAvatarUri(profile.avatarDataUri ?? readPersistedCurrentAvatar()),
            ),
          api
            .socialSummary(session.accessToken)
            .then((summary) => setFollowingIds(summary.following.map((person) => person.id))),
        );
      }
      const results = await Promise.allSettled(requests);
      if (results.some((result) => result.status === "rejected")) {
        setFeedNotice(
          "일부 정보를 새로 불러오지 못했습니다. 기존 내용은 유지됩니다. 다시 당겨서 시도해 주세요.",
        );
      }
    } finally {
      refreshBusyRef.current = false;
      setRefreshing(false);
    }
  }, [reload, session]);
  const selectedStoryOwner = useMemo(
    () => storyOwners.find((owner) => owner.id === selectedStoryOwnerId) ?? null,
    [selectedStoryOwnerId, storyOwners],
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

  function toggle(id: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveLike(post: FeedPost, liked: boolean) {
    if (!session) {
      setFeedNotice("로그인 후 좋아요를 누를 수 있습니다.");
      return;
    }
    if (likeRequests.current.has(post.id) || Boolean(post.likedByMe) === liked) return;
    likeRequests.current.add(post.id);
    try {
      const result = await api.setPostLiked(session.accessToken, post.id, liked);
      setPosts(
        (current) =>
          current?.map((item) =>
            item.id === post.id
              ? { ...item, likedByMe: result.liked, likeCount: result.likeCount }
              : item,
          ) ?? null,
      );
    } catch (caught) {
      setFeedNotice(caught instanceof Error ? caught.message : "좋아요를 저장하지 못했습니다.");
    } finally {
      likeRequests.current.delete(post.id);
    }
  }

  async function toggleFollow(userId: string, confirmed = false) {
    if (!session || followRequests.current.has(userId)) return;
    const following = followingIds.includes(userId);
    if (following && !confirmed) {
      setUnfollowTargetId(userId);
      return;
    }
    if (confirmed && !following) {
      setUnfollowTargetId(null);
      return;
    }
    followRequests.current.add(userId);
    setFollowBusyIds((current) => [...current, userId]);
    setFeedNotice(null);
    try {
      if (following) await api.unfollow(session.accessToken, userId);
      else await api.follow(session.accessToken, userId);
      setFollowingIds((current) =>
        following ? current.filter((id) => id !== userId) : [...new Set([...current, userId])],
      );
    } catch (caught) {
      setFeedNotice(caught instanceof Error ? caught.message : "팔로우 상태를 바꾸지 못했습니다.");
    } finally {
      followRequests.current.delete(userId);
      setUnfollowTargetId(null);
      setFollowBusyIds((current) => current.filter((id) => id !== userId));
    }
  }

  async function confirmDeletePost() {
    if (
      !session ||
      !deleteTargetPost ||
      deleteTargetPost.userId !== session.user.id ||
      deleteBusyRef.current
    )
      return;
    const postId = deleteTargetPost.id;
    deleteBusyRef.current = true;
    setDeletingPost(true);
    try {
      await api.deletePost(session.accessToken, postId);
      setPosts((current) => current?.filter((post) => post.id !== postId) ?? null);
      setDeleteTargetPost(null);
      setFeedNotice("게시물을 삭제했습니다. 원본 운동 기록은 그대로 남아 있습니다.");
    } catch (caught) {
      setDeleteTargetPost(null);
      setFeedNotice(
        caught instanceof Error
          ? caught.message
          : "게시물을 삭제하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      deleteBusyRef.current = false;
      setDeletingPost(false);
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

  const normalizedHashtag =
    feedLayout === "grid" && !sharedPostId
      ? (activeHashtag ?? hashtagSearch.trim()).replace(/^#/, "").toLowerCase()
      : "";
  const visiblePosts = posts?.filter(
    (post) =>
      storyIsActive(post) &&
      isRecordedFeedPost(post) &&
      hasFeedVisual(post) &&
      (sharedPostId ||
        (post.contentType !== "story" &&
          (!normalizedHashtag || extractHashtags(post.content).includes(normalizedHashtag)))),
  );
  const rankedPosts = useMemo(
    () =>
      rankHomeFeed(visiblePosts ?? [], {
        followingIds,
        ...(session?.user.id ? { viewerId: session.user.id } : {}),
        recommendationInterval: 3,
      }),
    [followingIds, session?.user.id, visiblePosts],
  );

  return (
    <Screen
      key={sharedPostId || "feed"}
      title=""
      onRefresh={refreshFeed}
      refreshing={refreshing}
      action={<NotificationBell />}
    >
      <UnfollowDialog
        visible={unfollowTargetId !== null}
        busy={unfollowTargetId !== null && followBusyIds.includes(unfollowTargetId)}
        onClose={() => setUnfollowTargetId(null)}
        onConfirm={() => {
          if (unfollowTargetId) void toggleFollow(unfollowTargetId, true);
        }}
      />
      <CenterDialog
        message={feedNotice ?? ""}
        onClose={() => setFeedNotice(null)}
        title="안내"
        visible={feedNotice !== null}
      />
      <CenterDialog
        visible={deleteTargetPost !== null}
        title="게시물을 삭제할까요?"
        message="이 게시물과 댓글·답글이 함께 삭제되며 되돌릴 수 없습니다. 연결된 원본 운동 기록은 삭제되지 않습니다."
        confirmLabel={deletingPost ? "삭제 중…" : "삭제"}
        busy={deletingPost}
        onClose={() => setDeleteTargetPost(null)}
        onConfirm={() => void confirmDeletePost()}
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
                      {activeDemoStory.post
                        ? relativeTime(activeDemoStory.post.createdAt)
                        : "미리보기"}{" "}
                      · {storyIndex + 1}/{selectedStoryOwner.stories.length}
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
                {activeDemoStory.post ? (
                  <View
                    style={{
                      height: storyCanvasHeight,
                      backgroundColor: "#171513",
                      justifyContent: "center",
                      overflow: "hidden",
                      borderRadius: 20,
                    }}
                  >
                    {activeDemoStory.post.mediaUrl ? (
                      <Image
                        source={{ uri: activeDemoStory.post.mediaUrl }}
                        resizeMode="contain"
                        style={StyleSheet.absoluteFill}
                      />
                    ) : (
                      <View style={{ padding: 28, gap: 24 }}>
                        <Text
                          style={{
                            color: "#FF5A32",
                            fontFamily: fonts.displayItalic,
                            fontSize: 22,
                            fontStyle: "italic",
                          }}
                        >
                          GROOV
                        </Text>
                        <Text style={{ color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 26 }}>
                          {activeDemoStory.post.content}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
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
                )}
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
                <View key={owner.id} style={styles.story}>
                  <Pressable
                    accessibilityLabel={`${owner.name} 스토리 ${owner.stories.length}개 열기`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      owner.id === "me" && !owner.stories.length
                        ? router.push({ pathname: "/compose", params: { kind: "story" } })
                        : openStory(owner.id)
                    }
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
                      {owner.id !== "me" ? (
                        <View style={styles.storyCountBadge}>
                          <Text style={styles.storyCountText}>{owner.stories.length}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={styles.storyName}>
                      {owner.name}
                    </Text>
                  </Pressable>
                  {owner.id === "me" ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="새 스토리 만들기"
                      hitSlop={8}
                      onPress={() =>
                        router.push({ pathname: "/compose", params: { kind: "story" } })
                      }
                      style={[
                        styles.storyCountBadge,
                        {
                          top: 32,
                          bottom: undefined,
                          right: -1,
                          height: 20,
                          width: 20,
                          paddingHorizontal: 0,
                        },
                      ]}
                    >
                      <Plus size={13} color="#FFFFFF" strokeWidth={3} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}
      <View style={styles.feedTitleRow}>
        <View>
          <Text style={styles.sectionEyebrow}>LATEST FEED</Text>
          <Text style={styles.sectionTitle}>{sharedPostId ? "공유된 피드" : "최신 피드"}</Text>
        </View>
        {!sharedPostId ? (
          <Pressable
            accessibilityLabel={
              feedLayout === "cards" ? "피드를 4열 목록으로 보기" : "피드를 카드로 보기"
            }
            accessibilityRole="button"
            onPress={() => setFeedLayout((current) => (current === "cards" ? "grid" : "cards"))}
            style={styles.layoutToggle}
          >
            <View style={styles.gridMark}>
              {[0, 1, 2, 3].map((square) => (
                <View
                  key={square}
                  style={[
                    styles.gridMarkSquare,
                    { backgroundColor: feedLayout === "grid" ? colors.primary : colors.ink },
                  ]}
                />
              ))}
            </View>
          </Pressable>
        ) : null}
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
      {feedLayout === "grid" && !sharedPostId && normalizedHashtag ? (
        <Text style={styles.hashtagResult}>#{normalizedHashtag} 피드만 보기</Text>
      ) : null}
      {loading && posts === null ? (
        <StatePanel state="loading" message="피드를 불러오는 중이에요." />
      ) : null}
      {error && posts === null ? (
        <StatePanel state="error" message={error} onRetry={() => void reload()} />
      ) : null}
      {posts?.length === 0 ? <StatePanel state="empty" message="첫 기록을 공유해 보세요." /> : null}
      {feedLayout === "grid" && !sharedPostId ? (
        <View style={styles.feedGrid}>
          {rankedPosts.map(({ post, source, reason }) => {
            const postImageSource = post.mediaUrl
              ? { uri: post.mediaUrl }
              : feedImageSources[post.id];
            return (
              <Pressable
                key={post.id}
                accessibilityLabel={`${post.authorDisplayName}의 ${sportLabels[post.sport]} 기록`}
                onPress={() => router.push(feedPostHref(post.id))}
                style={styles.feedGridCell}
              >
                {postImageSource ? (
                  <Image source={postImageSource} resizeMode="cover" style={styles.feedGridImage} />
                ) : post.workoutSummary ? (
                  <FeedGridWorkoutSummary post={post} styles={styles} />
                ) : (
                  <View style={styles.feedGridRecord}>
                    <Text style={styles.feedGridSport}>{sportLabels[post.sport]}</Text>
                    <Text numberOfLines={3} style={styles.feedGridCopy}>
                      {post.content}
                    </Text>
                  </View>
                )}
                {source === "recommended" ? (
                  <View style={styles.recommendationDot} accessibilityLabel={`추천: ${reason}`} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        rankedPosts.map(({ post, source, reason }) => {
          const cheered = Boolean(post.likedByMe);
          const commentsOpen = openComments.includes(post.id);
          const bookmarked = bookmarkedPosts.includes(post.id);
          const postAvatarSource = avatarSourceForUser(post.userId);
          const postImageSource = post.mediaUrl
            ? { uri: post.mediaUrl }
            : feedImageSources[post.id];
          return (
            <Pressable
              accessibilityHint="해당 피드만 자세히 봅니다."
              accessibilityLabel={`${post.authorDisplayName}의 ${sportLabels[post.sport]} 피드 열기`}
              accessibilityRole="button"
              key={post.id}
              onPress={() => {
                if (!sharedPostId) router.push(feedPostHref(post.id));
              }}
              style={({ pressed }) => [styles.post, pressed && !sharedPostId && styles.postPressed]}
            >
              {source === "recommended" ? (
                <View style={styles.recommendationLabel}>
                  <Text style={styles.recommendationLabelText}>추천 · {reason}</Text>
                </View>
              ) : null}
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
                {session?.user.id !== post.userId ? (
                  <Pressable
                    accessibilityLabel="게시물 신고"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => reportContent("post", post.id)}
                    style={styles.reportButton}
                  >
                    <Text style={styles.reportText}>신고</Text>
                  </Pressable>
                ) : null}
                <View style={styles.postHeaderMeta}>
                  <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
                  {session?.user.id !== post.userId ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void toggleFollow(post.userId)}
                      disabled={followBusyIds.includes(post.userId)}
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
                  {session?.user.id === post.userId ? (
                    <Pressable
                      accessibilityLabel="내 게시물 삭제"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setDeleteTargetPost(post)}
                      style={styles.deletePostButton}
                    >
                      <Text style={styles.deletePostText}>삭제</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <FeedPostVisual
                imageSource={postImageSource}
                liked={cheered}
                onLike={() => void saveLike(post, true)}
                post={post}
                styles={styles}
              />
              {post.workoutSummary && feedPresentation(post) === "photo-separate-record" ? (
                <FeedWorkoutSummary post={post} styles={styles} />
              ) : null}
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
                  accessibilityLabel={cheered ? "좋아요 취소" : "좋아요"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cheered }}
                  onPress={() => void saveLike(post, !cheered)}
                  style={styles.action}
                >
                  <Heart
                    color={cheered ? colors.primary : colors.ink}
                    fill={cheered ? colors.primary : "transparent"}
                    size={20}
                    strokeWidth={2}
                  />
                  <Text style={[styles.actionCount, cheered && styles.activeAction]}>
                    {post.likeCount}
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
              <View style={!commentsOpen && styles.hiddenComments}>
                <PostComments
                  post={post}
                  token={session?.accessToken}
                  userId={session?.user.id}
                  avatarSource={avatarSourceForUser}
                  onProfile={openMemberProfile}
                  onReport={(id) => reportContent("comment", id)}
                  onNotice={setFeedNotice}
                  onChange={(comment) =>
                    setPosts(
                      (current) =>
                        current?.map((item) =>
                          item.id !== post.id
                            ? item
                            : {
                                ...item,
                                comments: item.comments.some(
                                  (existing) => existing.id === comment.id,
                                )
                                  ? item.comments.map((existing) =>
                                      existing.id === comment.id ? comment : existing,
                                    )
                                  : [...item.comments, comment],
                              },
                        ) ?? null,
                    )
                  }
                />
              </View>
            </Pressable>
          );
        })
      )}
      {feedLayout === "grid" && !sharedPostId ? (
        <View style={styles.hashtagFooter}>
          <Text style={styles.hashtagFooterTitle}>해시태그로 기록 찾기</Text>
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
              placeholder="#러닝 #오운완"
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
        </View>
      ) : null}
    </Screen>
  );
}

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

function extractHashtags(value: string) {
  return [
    ...new Set((value.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase())),
  ];
}

function feedPresentation(post: FeedPost): FeedPresentation {
  const selected = (
    feedPresentations[post.id] ??
    (post.mediaUrl ? "photo-separate-record" : post.workoutSummary ? "record-only" : "photo-only")
  );
  if ((selected === "photo-route-overlay" || selected === "route-only") && !supportsGpsRoute(post.sport)) {
    return post.mediaUrl || feedImageSources[post.id] ? "photo-record-overlay" : "record-only";
  }
  return selected;
}

function supportsGpsRoute(sport: SportType) {
  return sport === "running" || sport === "cycling" || sport === "hiking";
}

function FeedPostVisual({
  imageSource,
  liked,
  onLike,
  post,
  styles,
}: {
  imageSource?: ImageSourcePropType | undefined;
  liked: boolean;
  onLike: () => void;
  post: FeedPost;
  styles: ReturnType<typeof createStyles>;
}) {
  const presentation = feedPresentation(post);
  const route = post.sport === "cycling" ? cyclingRoute : post.sport === "hiking" ? hikingRoute : runningRoute;
  const primary = feedOverlayPrimary(post);
  return (
    <FeedLikeSurface
      label={`${post.authorDisplayName}의 ${sportLabels[post.sport]} 피드`}
      liked={liked}
      onLike={onLike}
    >
      {presentation === "record-only" && post.workoutSummary ? (
        <FeedWorkoutSummary post={post} styles={styles} />
      ) : presentation === "route-only" ? (
        <View style={styles.routeOnlyVisual}>
          <WorkoutMap
            backgroundColor="#E6E3DC"
            currentPoint={undefined}
            height={340}
            isSample
            minimal
            points={route}
            primaryColor="#FF5A36"
            showBadge={false}
            staticMode
          />
          <View style={styles.routeOnlyMetric}>
            <Text style={styles.visualEyebrow}>{sportLabels[post.sport]} ROUTE</Text>
            <Text style={styles.routeOnlyValue}>{primary}</Text>
          </View>
        </View>
      ) : post.mediaUrl ? (
        <PostArtwork uri={post.mediaUrl} label={`${sportLabels[post.sport]} 기록 카드`} />
      ) : imageSource ? (
        <ImageBackground
          accessibilityLabel={`${sportLabels[post.sport]} 운동 사진`}
          imageStyle={styles.feedArtworkImage}
          resizeMode="cover"
          source={imageSource}
          style={styles.feedArtwork}
        >
          {presentation !== "photo-only" ? (
            <LinearGradient
              colors={gradients.imageOverlay.colors}
              end={gradients.imageOverlay.end}
              start={gradients.imageOverlay.start}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {presentation === "photo-record-overlay" ? (
            <View style={styles.photoMetricOverlay}>
              <Text style={styles.visualEyebrow}>{sportLabels[post.sport]} RECORD</Text>
              <Text style={styles.photoMetricValue}>{primary}</Text>
              <Text style={styles.photoMetricMeta}>{feedOverlayMeta(post)}</Text>
            </View>
          ) : null}
          {presentation === "photo-route-overlay" ? (
            <View style={styles.photoRouteOverlay}>
              <View style={styles.photoRouteTrace}>
                <RouteTrace color="#FF5A36" points={route} strokeWidth={4} />
              </View>
              <Text style={styles.photoRouteValue}>{primary}</Text>
            </View>
          ) : null}
        </ImageBackground>
      ) : post.workoutSummary ? (
        <FeedWorkoutSummary post={post} styles={styles} />
      ) : null}
    </FeedLikeSurface>
  );
}

function feedOverlayPrimary(post: FeedPost) {
  const metrics = post.workoutSummary?.metrics ?? {};
  if (post.sport === "strength") return `${Math.round(metrics.sets ?? 0)} SETS`;
  if (post.sport === "swimming") return `${Math.round(metrics.distanceM ?? (metrics.distanceKm ?? 0) * 1000)} M`;
  return `${(metrics.distanceKm ?? (metrics.distanceM ?? 0) / 1000).toFixed(2)} KM`;
}

function feedOverlayMeta(post: FeedPost) {
  const metrics = post.workoutSummary?.metrics ?? {};
  const minutes = Math.round(metrics.durationMinutes ?? 0);
  if (post.sport === "strength") return `${Math.round(metrics.exerciseCount ?? 0)} MOVES · ${Math.round(metrics.volumeKg ?? 0).toLocaleString()} KG`;
  if (post.sport === "swimming") return `${minutes} MIN · ${Math.round(metrics.laps ?? 0)} LAPS`;
  return `${minutes} MIN · ${Math.round(metrics.calories ?? 0)} KCAL`;
}

function FeedWorkoutSummary({
  post,
  styles,
}: {
  post: FeedPost;
  styles: ReturnType<typeof createStyles>;
}) {
  const summary = post.workoutSummary!;
  const metrics = summary.metrics;
  const durationMinutes = Math.max(
    0,
    metrics.durationMinutes ??
      (Date.parse(summary.endedAt) - Date.parse(summary.startedAt)) / 60_000,
  );
  const distanceKm = metrics.distanceKm ?? (metrics.distanceM ?? 0) / 1000;
  const primary =
    post.sport === "strength"
      ? { value: `${Math.round(metrics.sets ?? 0)}`, unit: "SETS", label: "완료 세트" }
      : post.sport === "swimming" && metrics.distanceM
        ? { value: `${Math.round(metrics.distanceM)}`, unit: "M", label: "수영 거리" }
        : distanceKm > 0
          ? { value: distanceKm.toFixed(2), unit: "KM", label: "이동 거리" }
          : { value: `${Math.round(durationMinutes)}`, unit: "MIN", label: "운동 시간" };
  const secondary = workoutSecondaryMetrics(post.sport, metrics, durationMinutes).slice(0, 5);
  const variant = recordCardVariant(post.id);
  if (variant === "stub") {
    return (
      <View style={styles.recordTicketCard}>
        <View style={styles.recordTicketRail}>
          <Text style={styles.recordTicketRailText}>GROOV RECORD</Text>
        </View>
        <View style={styles.recordTicketBody}>
          <View style={styles.recordTicketHeader}>
            <View style={styles.recordTicketVerified}>
              <Text style={styles.recordTicketVerifiedText}>{sportLabels[post.sport]}</Text>
            </View>
            <Text style={styles.recordTicketDate}>TODAY · VERIFIED</Text>
          </View>
          <View style={styles.recordTicketPrimary}>
            <Text style={styles.recordTicketPrimaryValue}>{primary.value}</Text>
            <Text style={styles.recordTicketPrimaryUnit}>{primary.unit}</Text>
          </View>
          <View style={styles.recordTicketCut} />
          <View style={styles.recordTicketMetrics}>
            {secondary.map((metric) => (
              <View key={metric.label} style={styles.recordTicketMetric}>
                <Text style={styles.recordTicketMetricValue}>{metric.value}</Text>
                <Text style={styles.recordTicketMetricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.workoutSummaryCard, styles.recordCardCore]}>
      <View style={styles.recordCoreTag}>
        <Text style={styles.recordCoreTagText}>{sportLabels[post.sport]}</Text>
      </View>
      <View style={styles.recordCoreCenter}>
        <Text style={styles.recordCoreLabel}>{primary.label.toUpperCase()}</Text>
        <Text style={styles.recordCoreValue}>{primary.value}</Text>
        <Text style={styles.recordCoreUnit}>{primary.unit}</Text>
      </View>
      <View style={styles.workoutSummaryMetrics}>
        {secondary.slice(0, 3).map((metric) => (
          <View
            key={metric.label}
            style={styles.workoutSummaryMetric}
          >
            <Text style={styles.workoutSummaryMetricValue}>
              {metric.value}
            </Text>
            <Text style={styles.workoutSummaryMetricLabel}>
              {metric.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FeedGridWorkoutSummary({
  post,
  styles,
}: {
  post: FeedPost;
  styles: ReturnType<typeof createStyles>;
}) {
  const metrics = post.workoutSummary!.metrics;
  const durationMinutes = Math.max(
    0,
    metrics.durationMinutes ??
      (Date.parse(post.workoutSummary!.endedAt) - Date.parse(post.workoutSummary!.startedAt)) /
        60_000,
  );
  const distanceKm = metrics.distanceKm ?? (metrics.distanceM ?? 0) / 1000;
  const primary =
    post.sport === "strength"
      ? { value: `${Math.round(metrics.sets ?? 0)}`, unit: "SETS" }
      : post.sport === "swimming" && metrics.distanceM
        ? { value: `${Math.round(metrics.distanceM)}`, unit: "M" }
        : distanceKm > 0
          ? { value: distanceKm.toFixed(2), unit: "KM" }
          : { value: `${Math.round(durationMinutes)}`, unit: "MIN" };
  const secondary = workoutSecondaryMetrics(post.sport, metrics, durationMinutes).slice(0, 3);

  if (recordCardVariant(post.id) === "stub") {
    return (
      <View style={styles.feedGridTicket}>
        <View style={styles.feedGridTicketRail} />
        <View style={styles.feedGridTicketBody}>
          <Text style={styles.feedGridTicketSport}>{sportLabels[post.sport]}</Text>
          <View style={styles.feedGridTicketPrimary}>
            <Text style={styles.feedGridTicketValue}>{primary.value}</Text>
            <Text style={styles.feedGridTicketUnit}>{primary.unit}</Text>
          </View>
          <View style={styles.feedGridTicketRule} />
          <Text numberOfLines={1} style={styles.feedGridTicketMeta}>
            {secondary.map((metric) => metric.value).join(" · ")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.feedGridCore}>
      <View style={styles.feedGridCoreTag}>
        <Text style={styles.feedGridCoreTagText}>{sportLabels[post.sport]}</Text>
      </View>
      <View style={styles.feedGridCoreCenter}>
        <Text style={styles.feedGridCoreValue}>{primary.value}</Text>
        <Text style={styles.feedGridCoreUnit}>{primary.unit}</Text>
      </View>
      <View style={styles.feedGridCoreMetrics}>
        {secondary.map((metric) => (
          <Text key={metric.label} numberOfLines={1} style={styles.feedGridCoreMetric}>
            {metric.value}
          </Text>
        ))}
      </View>
    </View>
  );
}

function recordCardVariant(postId: string) {
  const checksum = [...postId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return checksum % 2 === 0 ? "core" : "stub";
}

function workoutSecondaryMetrics(
  sport: SportType,
  metrics: Record<string, number>,
  durationMinutes: number,
) {
  const result = [{ label: "TIME", value: formatFeedDuration(durationMinutes) }];
  if (sport === "strength") {
    result.push({ label: "MOVES", value: `${Math.round(metrics.exerciseCount ?? 0)} moves` });
    result.push({
      label: "VOLUME",
      value: `${Math.round(metrics.volumeKg ?? 0).toLocaleString()} kg`,
    });
  } else if (sport === "cycling") {
    result.push({ label: "SPEED", value: `${(metrics.averageSpeedKmh ?? 0).toFixed(1)} km/h` });
    result.push({ label: "ENERGY", value: `${Math.round(metrics.calories ?? 0)} kcal` });
  } else if (sport === "running" && metrics.paceSeconds) {
    result.push({ label: "PACE", value: formatFeedPace(metrics.paceSeconds) });
    result.push({ label: "ENERGY", value: `${Math.round(metrics.calories ?? 0)} kcal` });
  } else {
    result.push({ label: "ELEVATION", value: `${Math.round(metrics.elevationGainM ?? 0)} m` });
    result.push({ label: "ENERGY", value: `${Math.round(metrics.calories ?? 0)} kcal` });
  }
  return result;
}

function formatFeedDuration(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function formatFeedPace(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}′${String(rounded % 60).padStart(2, "0")}″/km`;
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
    feedTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    layoutToggle: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    gridMark: {
      width: 21,
      height: 21,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 3,
    },
    gridMarkSquare: { width: 9, height: 9, borderRadius: 1.5 },
    feedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
    feedGridCell: {
      width: "24.4%",
      aspectRatio: 1,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
      position: "relative",
    },
    feedGridImage: { width: "100%", height: "100%" },
    feedGridRecord: {
      flex: 1,
      padding: 7,
      justifyContent: "space-between",
      backgroundColor: colors.ink,
    },
    feedGridSport: { color: colors.primary, fontSize: 7, fontFamily: fonts.bold },
    feedGridCopy: {
      color: colors.background,
      fontSize: 8,
      lineHeight: 11,
      fontFamily: fonts.semibold,
    },
    feedGridCore: {
      flex: 1,
      backgroundColor: "#0A0A09",
      padding: 7,
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: "#2A1712",
    },
    feedGridCoreTag: {
      alignSelf: "flex-start",
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 5,
      paddingVertical: 3,
    },
    feedGridCoreTagText: {
      color: "#0A0A09",
      fontFamily: fonts.bold,
      fontSize: 5,
      letterSpacing: 0.5,
    },
    feedGridCoreCenter: { alignItems: "center" },
    feedGridCoreValue: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 24,
      letterSpacing: -1.5,
      lineHeight: 27,
    },
    feedGridCoreUnit: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 5,
      letterSpacing: 1.2,
    },
    feedGridCoreMetrics: {
      flexDirection: "row",
      gap: 3,
      borderTopWidth: 1,
      borderTopColor: "#2A1712",
      paddingTop: 4,
    },
    feedGridCoreMetric: { flex: 1, color: colors.primary, fontFamily: fonts.bold, fontSize: 5 },
    feedGridTicket: { flex: 1, flexDirection: "row", backgroundColor: "#0A0A09" },
    feedGridTicketRail: { width: 13, backgroundColor: colors.primary },
    feedGridTicketBody: { flex: 1, padding: 7, justifyContent: "space-between" },
    feedGridTicketSport: { color: colors.primary, fontFamily: fonts.bold, fontSize: 6 },
    feedGridTicketPrimary: { flexDirection: "row", alignItems: "baseline" },
    feedGridTicketValue: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 22,
      letterSpacing: -1.5,
    },
    feedGridTicketUnit: { color: colors.primary, fontFamily: fonts.bold, fontSize: 5, marginLeft: 3 },
    feedGridTicketRule: { borderTopWidth: 1, borderStyle: "dashed", borderColor: "#442018" },
    feedGridTicketMeta: { color: colors.primary, opacity: 0.7, fontFamily: fonts.bold, fontSize: 5 },
    recommendationDot: {
      position: "absolute",
      right: 5,
      top: 5,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: "#FFFFFF",
    },
    recommendationLabel: {
      alignSelf: "flex-start",
      borderRadius: radius.full,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 9,
      paddingVertical: 4,
      marginBottom: 8,
    },
    recommendationLabelText: { color: colors.primary, fontSize: 8, fontFamily: fonts.bold },
    hashtagFooter: {
      marginTop: 8,
      marginBottom: 18,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 9,
    },
    hashtagFooterTitle: { color: colors.ink, fontSize: 12, fontFamily: fonts.bold },
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
    postPressed: { opacity: 0.96 },
    postHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 9, minWidth: 0 },
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
    reportButton: { marginLeft: 7, paddingHorizontal: 2, paddingVertical: 5 },
    postHeaderMeta: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
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
    reportText: { color: colors.muted, fontSize: 8, fontFamily: fonts.medium },
    time: { color: colors.muted, fontSize: 10, fontFamily: fonts.regular },
    routeOnlyVisual: {
      height: 340,
      overflow: "hidden",
      borderRadius: radius["2xl"],
      position: "relative",
    },
    routeOnlyMetric: {
      position: "absolute",
      left: 16,
      bottom: 16,
      borderRadius: radius.md,
      backgroundColor: "rgba(15,14,13,0.9)",
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    routeOnlyValue: { color: "#FFFFFF", fontSize: 22, fontFamily: fonts.displayExtra },
    visualEyebrow: {
      color: colors.primary,
      fontSize: 8,
      fontFamily: fonts.bold,
      letterSpacing: 1.1,
      marginBottom: 5,
    },
    photoMetricOverlay: { position: "absolute", left: 22, right: 22, bottom: 24 },
    photoMetricValue: { color: "#FFFFFF", fontSize: 38, fontFamily: fonts.displayExtra },
    photoMetricMeta: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 9,
      fontFamily: fonts.bold,
      letterSpacing: 0.7,
      marginTop: 3,
    },
    photoRouteOverlay: {
      position: "absolute",
      right: 18,
      bottom: 18,
      width: 150,
      height: 92,
      borderRadius: radius.lg,
      backgroundColor: "rgba(12,12,12,0.72)",
      overflow: "hidden",
    },
    photoRouteTrace: {
      position: "absolute",
      left: 8,
      right: 8,
      top: 7,
      bottom: 26,
    },
    routeStroke: {
      position: "absolute",
      left: 9,
      top: 38,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    routeDot: {
      position: "absolute",
      right: 10,
      top: 37,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#FFFFFF",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    photoRouteValue: {
      position: "absolute",
      left: 10,
      bottom: 8,
      color: "#FFFFFF",
      fontSize: 13,
      fontFamily: fonts.bold,
    },
    workoutSummaryCard: {
      marginTop: 10,
      aspectRatio: 16 / 9,
      borderRadius: 28,
      backgroundColor: "#0A0A09",
      borderWidth: 1,
      borderColor: "#2A1712",
      paddingHorizontal: 20,
      paddingTop: 19,
      paddingBottom: 18,
      overflow: "hidden",
    },
    recordCardCore: { justifyContent: "space-between" },
    recordCoreTag: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    recordCoreTagText: {
      color: "#0A0A09",
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 1.2,
    },
    recordCoreCenter: { alignItems: "center" },
    recordCoreLabel: {
      color: colors.primary,
      opacity: 0.62,
      fontFamily: fonts.medium,
      fontSize: 8,
      letterSpacing: 1,
    },
    recordCoreValue: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 78,
      letterSpacing: -5,
      lineHeight: 88,
    },
    recordCoreUnit: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 9,
      letterSpacing: 3,
    },
    recordTicketCard: {
      marginTop: 10,
      aspectRatio: 16 / 9,
      flexDirection: "row",
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: "#0A0A09",
      borderWidth: 1,
      borderColor: "#2A1712",
    },
    recordTicketRail: {
      width: 54,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 2,
      borderRightColor: "#0A0A09",
      borderStyle: "dashed",
    },
    recordTicketRailText: {
      color: "#0A0A09",
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.5,
      width: 128,
      textAlign: "center",
      transform: [{ rotate: "-90deg" }],
    },
    recordTicketBody: {
      flex: 1,
      padding: 17,
      justifyContent: "space-between",
    },
    recordTicketHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    recordTicketVerified: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    recordTicketVerifiedText: {
      color: "#0A0A09",
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 1,
    },
    recordTicketDate: {
      color: colors.primary,
      opacity: 0.55,
      fontFamily: fonts.medium,
      fontSize: 8,
      letterSpacing: 0.8,
    },
    recordTicketPrimary: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "flex-start",
      paddingVertical: 6,
    },
    recordTicketPrimaryValue: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 54,
      letterSpacing: -4,
    },
    recordTicketPrimaryUnit: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 10,
      marginLeft: 7,
    },
    recordTicketCut: {
      borderTopWidth: 1,
      borderColor: "#442018",
      borderStyle: "dashed",
    },
    recordTicketMetrics: {
      flexDirection: "row",
      gap: 8,
      paddingTop: 10,
    },
    recordTicketMetric: { flex: 1 },
    recordTicketMetricValue: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 10,
    },
    recordTicketMetricLabel: {
      color: colors.primary,
      opacity: 0.45,
      fontFamily: fonts.medium,
      fontSize: 7,
      marginTop: 4,
    },
    workoutSummaryMetrics: {
      flexDirection: "row",
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: "#2A1712",
      paddingTop: 8,
    },
    workoutSummaryMetric: {
      flex: 1,
    },
    workoutSummaryMetricValue: { color: colors.primary, fontSize: 11, fontFamily: fonts.bold },
    workoutSummaryMetricLabel: {
      color: colors.primary,
      opacity: 0.48,
      fontSize: 7,
      fontFamily: fonts.medium,
      marginTop: 3,
    },
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
    feedRecordSummary: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 12,
      lineHeight: 17,
      fontFamily: fonts.medium,
      marginTop: 7,
      maxWidth: "86%",
    },
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
    hiddenComments: { display: "none" },
    deletePostButton: { minHeight: 32, justifyContent: "center" },
    deletePostText: { color: colors.primary, fontSize: 10, fontFamily: fonts.medium },
  });
}
