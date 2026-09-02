import {
  savePreviewImage,
  hydratePreviewImages,
  previewImageUri,
  deletePreviewImage,
} from "../media/preview-media.ts";
import {
  sportLabels,
  sportValues,
  type AuthSession,
  type AccountDeletionInput,
  type AccountSession,
  type AppleLoginInput,
  type AuthorizationCodeLoginInput,
  type CommentCreateInput,
  type ContentReport,
  type ContentReportCreateInput,
  type ConsentState,
  type ConsentUpdateInput,
  type DirectMessage,
  type DirectMessageCreateInput,
  type FeedPost,
  type GoogleLoginInput,
  type KnowledgeArticle,
  type KnowledgeFeedback,
  type KnowledgeFeedbackCreateInput,
  type LoginInput,
  type Medal,
  type MediaUploadRequestInput,
  type MediaUploadTicket,
  type ModerationReportUpdateInput,
  type OnboardingInput,
  type OnboardingProfile,
  type PasswordChangeInput,
  type PostCreateInput,
  type PostShareResult,
  type PostUpdateInput,
  type ProfileUpdateInput,
  type PublicMemberProfile,
  type RegisterInput,
  type RefreshSessionInput,
  type Routine,
  type RoutineCreateInput,
  type RoutineReorderInput,
  type RoutineUpdateInput,
  type SocialSummary,
  type SportSummary,
  type SportType,
  type UserNotification,
  type WorkoutSession,
  type WorkoutSessionCreateInput,
  type WorkoutSessionUpdateInput,
} from "@moveall/contracts";

const now = Date.now();
const safetyNotice =
  "통증, 어지럼증, 호흡 곤란 또는 이상 증상이 있으면 운동을 중단하고 자격을 갖춘 전문가에게 상담하세요.";

const demoSports: SportSummary[] = sportValues.map((id) => ({
  id,
  label: sportLabels[id],
  safetyLevel: ["diving", "hiking", "swimming"].includes(id) ? "heightened" : "standard",
  knowledgeReviewStatus: "DRAFT",
}));

const articleSeeds: KnowledgeArticle[] = [
  article(
    "strength-foundation",
    "strength",
    "입문 · 프로그램",
    "처음 만드는 전신 근력운동의 기준",
    "큰 근육군을 고르게 사용하고 현재 가능한 범위에서 점진적으로 부하를 높이는 것이 기본입니다.",
    [
      "주요 근육군을 고르게 포함합니다.",
      "반복 가능한 자세를 먼저 확보합니다.",
      "회복 상태를 기록하며 운동량을 조절합니다.",
    ],
    "처음이거나 오래 쉬었다면 가벼운 저항부터 시작하세요.",
    "Physical Activity Guidelines for Americans",
    "U.S. Department of Health and Human Services",
    "https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines",
  ),
  article(
    "running-easy-start",
    "running",
    "입문 · 강도",
    "이지런을 시작하는 가장 단순한 방법",
    "짧은 걷기와 달리기를 섞고 대화가 가능한 편안한 강도로 운동 시간을 쌓습니다.",
    [
      "적은 양으로 시작해 서서히 늘립니다.",
      "준비운동과 정리운동을 포함합니다.",
      "거리와 속도를 동시에 크게 늘리지 않습니다.",
    ],
    "더운 날에는 시간대를 바꾸거나 강도를 낮추세요.",
    "Physical Activity Guidelines for Americans",
    "U.S. Department of Health and Human Services",
    "https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines",
    [
      {
        id: "feedback-running-demo",
        articleId: "running-easy-start",
        userId: "demo-friend-1",
        authorDisplayName: "새벽러너 민지",
        content: "처음 2주는 3분 달리기와 2분 걷기를 번갈아 하니 무리 없이 이어갈 수 있었어요.",
        context: "러닝 입문 · 주 3회",
        createdAt: new Date(now - 42 * 60_000).toISOString(),
      },
    ],
  ),
  article(
    "hiking-essentials",
    "hiking",
    "장비 · 준비",
    "출발 전에 챙기는 10가지 안전 체계",
    "날씨 변화와 지연에 대비해 항법, 보온, 조명, 응급처치, 식수와 비상물품을 준비합니다.",
    [
      "공식 날씨와 탐방로 정보를 확인합니다.",
      "일몰 전 귀환 시점을 정합니다.",
      "목적지와 귀환 예정 시간을 공유합니다.",
    ],
    "고도 상승과 계절에 따라 추가 장비가 필요합니다.",
    "Ten Essentials",
    "U.S. National Park Service",
    "https://www.nps.gov/articles/10essentials.htm",
  ),
  article(
    "diving-equalization",
    "diving",
    "핵심 기술 · 압력",
    "압력 평형은 통증 전에, 자주, 부드럽게",
    "하강 중 압력 평형이 되지 않으면 멈추거나 조금 상승해 다시 시도합니다.",
    [
      "하강 전에 평형을 시작합니다.",
      "통증이 생기면 상승합니다.",
      "평형이 되지 않으면 다이빙을 중단합니다.",
    ],
    "감기나 알레르기가 있다면 보수적으로 판단하세요.",
    "Middle-Ear Equalization",
    "Divers Alert Network",
    "https://dan.org/health-medicine/health-resources/diseases-conditions/middle-ear-equalization/",
  ),
  article(
    "cycling-road-ready",
    "cycling",
    "장비 · 도로 안전",
    "출발 전 자전거와 헬멧 점검",
    "몸에 맞는 자전거, 작동하는 브레이크, 올바르게 맞춘 헬멧이 라이딩의 출발점입니다.",
    [
      "타이어와 브레이크를 확인합니다.",
      "헬멧을 머리에 맞게 조정합니다.",
      "교통 표지와 신호를 따릅니다.",
    ],
    "출발 지역의 자전거 관련 규정을 확인하세요.",
    "Bicycle Safety",
    "U.S. National Highway Traffic Safety Administration",
    "https://www.nhtsa.gov/road-safety/bicycle-safety",
  ),
  article(
    "swimming-water-safety",
    "swimming",
    "안전 · 익수 예방",
    "수영 실력과 별개로 지켜야 할 물 안전",
    "수영 능력이 있어도 자연 수역과 수영장에서는 감독, 구명 장비와 현장 규칙을 지킵니다.",
    [
      "자신의 능력에 맞는 구역을 이용합니다.",
      "필요한 활동에서는 구명조끼를 사용합니다.",
      "현장 구조와 응급 절차를 확인합니다.",
    ],
    "바다와 강에서는 조류, 수온과 시야를 별도로 확인하세요.",
    "Guidelines for Healthy and Safe Swimming",
    "U.S. Centers for Disease Control and Prevention",
    "https://www.cdc.gov/healthy-swimming/safety/index.html",
  ),
];

const posts: FeedPost[] = [
  {
    id: "demo-post-running",
    userId: "demo-friend-1",
    authorDisplayName: "새벽러너 민지",
    sport: "running",
    content: "러닝 5.24km 완료! 지도와 완주 셀피를 함께 기록했어요.",
    contentType: "post",
    likeCount: 42,
    createdAt: new Date(now - 2 * 60 * 60_000).toISOString(),
    comments: [
      {
        id: "demo-comment-1",
        userId: "demo-friend-2",
        authorDisplayName: "페이스메이커 준",
        content: "꾸준한 이지런이 가장 강한 기반이에요!",
        likeCount: 0,
        likedByMe: false,
        createdAt: new Date(now - 90 * 60_000).toISOString(),
      },
    ],
  },
  {
    id: "demo-post-hiking",
    userId: "demo-friend-3",
    authorDisplayName: "클라이머 도윤",
    sport: "hiking",
    content: "주말 북한산 크루 준비 중입니다. 물과 보온 레이어를 꼭 챙겨요.",
    contentType: "story",
    likeCount: 28,
    createdAt: new Date(now - 4 * 60 * 60_000).toISOString(),
    comments: [],
  },
  {
    id: "demo-post-cycling",
    userId: "demo-friend-2",
    authorDisplayName: "페이스메이커 준",
    sport: "cycling",
    content: "한강 31.4km. 마지막 구간까지 케이던스를 유지했습니다.",
    contentType: "post",
    likeCount: 36,
    createdAt: new Date(now - 6 * 60 * 60_000).toISOString(),
    comments: [],
  },
  {
    id: "demo-post-strength",
    userId: "demo-friend-4",
    authorDisplayName: "스트롱 유나",
    sport: "strength",
    content: "하체 루틴 5종목 18세트 완료. 오늘도 한 칸 전진.",
    contentType: "post",
    likeCount: 51,
    createdAt: new Date(now - 8 * 60 * 60_000).toISOString(),
    comments: [],
  },
  {
    id: "demo-post-swimming",
    userId: "demo-friend-4",
    authorDisplayName: "스트롱 유나",
    sport: "swimming",
    content: "오전 자유형 1,700m · 68 LAP. 호흡 리듬이 돌아왔어요.",
    contentType: "story",
    likeCount: 44,
    createdAt: new Date(now - 26 * 60 * 60_000).toISOString(),
    comments: [],
  },
  {
    id: "demo-post-taeo",
    userId: "demo-friend-6",
    authorDisplayName: "리프트 태오",
    sport: "strength",
    content: "상체 루틴 6종목 18세트. 마지막 세트까지 집중했습니다.",
    contentType: "post",
    likeCount: 23,
    createdAt: new Date(now - 30 * 60 * 60_000).toISOString(),
    comments: [],
  },
  {
    id: "demo-post-seoa",
    userId: "demo-friend-7",
    authorDisplayName: "스튜디오 서아",
    sport: "strength",
    content: "등과 어깨 16세트 완료. 자세에 집중한 저녁 루틴.",
    contentType: "story",
    likeCount: 39,
    createdAt: new Date(now - 34 * 60 * 60_000).toISOString(),
    comments: [],
  },
  {
    id: "demo-post-jiyoung",
    userId: "demo-friend-8",
    authorDisplayName: "스트롱 지영",
    sport: "strength",
    content: "하체 루틴 5종목 완료. 오늘의 볼륨도 차분하게 채웠어요.",
    contentType: "post",
    likeCount: 47,
    createdAt: new Date(now - 38 * 60 * 60_000).toISOString(),
    comments: [],
  },
];

const defaultRoutines: Routine[] = [
  {
    id: "demo-routine-strength",
    userId: "demo-user",
    title: "월수금 전신 루틴",
    sport: "strength",
    daysOfWeek: [1, 3, 5],
    items: [
      { name: "스쿼트", target: "10회 · 4세트 · 예상 12분 · 휴식 2분", order: 0 },
      { name: "벤치프레스", target: "8회 · 4세트 · 예상 12분 · 휴식 2분", order: 1 },
      { name: "바벨 로우", target: "10회 · 4세트 · 예상 10분 · 휴식 1분", order: 2 },
    ],
    sortOrder: 0,
    createdAt: new Date(now - 7 * 86_400_000).toISOString(),
  },
];

const defaultWorkoutSeeds: WorkoutSession[] = [
  demoWorkout("running-5k", "running", 1, 31, 6, "퇴근 후 한강 이지런", {
    distanceKm: 5.12,
    calories: 368,
    paceSeconds: 363,
    elevationGainM: 24,
  }),
  demoWorkout("running-tempo", "running", 5, 44, 7, "템포 구간을 섞은 7K 러닝", {
    distanceKm: 7.34,
    calories: 526,
    paceSeconds: 360,
    elevationGainM: 38,
  }),
  demoWorkout("running-long", "running", 12, 64, 7, "주말 오전 10K 롱런", {
    distanceKm: 10.18,
    calories: 704,
    paceSeconds: 377,
    elevationGainM: 57,
  }),
  demoWorkout("hiking-bukhansan", "hiking", 2, 126, 7, "북한산 백운대 왕복", {
    distanceKm: 6.42,
    calories: 684,
    elevationGainM: 498,
  }),
  demoWorkout("hiking-gwanaksan", "hiking", 8, 172, 8, "관악산 능선 코스", {
    distanceKm: 8.76,
    calories: 912,
    elevationGainM: 731,
  }),
  demoWorkout("hiking-inwangsan", "hiking", 15, 82, 5, "인왕산 야간 산책", {
    distanceKm: 4.18,
    calories: 436,
    elevationGainM: 286,
  }),
  demoWorkout("cycling-riverside", "cycling", 3, 58, 6, "반포에서 여의도까지 리버사이드 라이딩", {
    distanceKm: 18.62,
    calories: 514,
    averageSpeedKmh: 19.3,
    paceSeconds: 187,
  }),
  demoWorkout("cycling-hanam", "cycling", 9, 94, 7, "미사리 왕복 지구력 라이딩", {
    distanceKm: 31.48,
    calories: 826,
    averageSpeedKmh: 20.1,
    paceSeconds: 179,
  }),
  demoWorkout("cycling-long", "cycling", 16, 126, 8, "주말 40K 롱 라이딩", {
    distanceKm: 42.26,
    calories: 1092,
    averageSpeedKmh: 20.1,
    paceSeconds: 179,
  }),
  demoWorkout("strength-full-body", "strength", 4, 52, 7, "스쿼트 · 벤치프레스 · 로우", {
    calories: 382,
    exerciseCount: 5,
    cycles: 4,
    sets: 16,
    volumeKg: 4280,
  }),
  demoWorkout("strength-lower", "strength", 10, 61, 8, "하체 집중 볼륨 세션", {
    calories: 448,
    exerciseCount: 6,
    cycles: 5,
    sets: 20,
    volumeKg: 6720,
  }),
  demoWorkout("strength-upper", "strength", 17, 47, 6, "등과 어깨 중심 상체 루틴", {
    calories: 336,
    exerciseCount: 5,
    cycles: 4,
    sets: 17,
    volumeKg: 3910,
  }),
  demoWorkout("swimming-technique", "swimming", 6, 42, 5, "자유형 호흡과 스트림라인 드릴", {
    distanceKm: 1.2,
    distanceM: 1200,
    calories: 304,
    laps: 48,
  }),
  demoWorkout("swimming-interval", "swimming", 11, 51, 7, "100m 인터벌 10세트", {
    distanceKm: 1.5,
    distanceM: 1500,
    calories: 386,
    laps: 60,
  }),
  demoWorkout("swimming-endurance", "swimming", 18, 66, 7, "페이스를 유지한 2K 지속주", {
    distanceKm: 2,
    distanceM: 2000,
    calories: 498,
    laps: 80,
  }),
  demoWorkout("diving-pool", "diving", 7, 55, 5, "잠실 풀 세션 · 이퀄라이징 점검", {
    calories: 246,
    maxDepthM: 18,
    dynamicDistanceM: 42,
  }),
  demoWorkout("diving-depth", "diving", 13, 68, 7, "딥 다이빙 트레이닝", {
    calories: 312,
    maxDepthM: 24.3,
    dynamicDistanceM: 55,
  }),
  demoWorkout("diving-dynamic", "diving", 20, 49, 8, "다이나믹 거리 PB 세션", {
    calories: 228,
    maxDepthM: 15.6,
    dynamicDistanceM: 75,
  }),
];

const demoMemberDirectory: Record<
  string,
  {
    displayName: string;
    isPrivate: boolean;
    followersCount: number;
    followingCount: number;
  }
> = {
  "demo-friend-1": {
    displayName: "새벽러너 민지",
    isPrivate: false,
    followersCount: 128,
    followingCount: 84,
  },
  "demo-friend-2": {
    displayName: "페이스메이커 준",
    isPrivate: false,
    followersCount: 214,
    followingCount: 96,
  },
  "demo-friend-3": {
    displayName: "클라이머 도윤",
    isPrivate: false,
    followersCount: 91,
    followingCount: 73,
  },
  "demo-friend-4": {
    displayName: "스트롱 유나",
    isPrivate: false,
    followersCount: 346,
    followingCount: 112,
  },
  "demo-friend-private": {
    displayName: "블루 하린",
    isPrivate: true,
    followersCount: 72,
    followingCount: 58,
  },
  "demo-friend-6": {
    displayName: "리프트 태오",
    isPrivate: false,
    followersCount: 64,
    followingCount: 51,
  },
  "demo-friend-7": {
    displayName: "스튜디오 서아",
    isPrivate: false,
    followersCount: 183,
    followingCount: 76,
  },
  "demo-friend-8": {
    displayName: "스트롱 지영",
    isPrivate: false,
    followersCount: 157,
    followingCount: 89,
  },
};

const demoMemberWorkouts: Record<string, WorkoutSession[]> = {
  "demo-friend-1": [
    demoMemberWorkout("demo-friend-1", "minji-run-1", "running", 1, 31, 6, "새벽 한강 5K", {
      distanceKm: 5.24,
      calories: 372,
      paceSeconds: 355,
      elevationGainM: 18,
    }),
    demoMemberWorkout("demo-friend-1", "minji-run-2", "running", 5, 48, 7, "템포런 8K", {
      distanceKm: 8.02,
      calories: 564,
      paceSeconds: 359,
      elevationGainM: 31,
    }),
    demoMemberWorkout("demo-friend-1", "minji-run-3", "running", 12, 66, 7, "주말 롱런", {
      distanceKm: 10.4,
      calories: 728,
      paceSeconds: 381,
      elevationGainM: 47,
    }),
  ],
  "demo-friend-2": [
    demoMemberWorkout("demo-friend-2", "jun-cycle-1", "cycling", 2, 94, 7, "한강 리버 라이드", {
      distanceKm: 31.48,
      calories: 826,
      averageSpeedKmh: 20.1,
      elevationGainM: 82,
    }),
    demoMemberWorkout("demo-friend-2", "jun-run-1", "running", 7, 27, 8, "5K 페이스 테스트", {
      distanceKm: 5,
      calories: 354,
      paceSeconds: 324,
      elevationGainM: 14,
    }),
  ],
  "demo-friend-3": [
    demoMemberWorkout("demo-friend-3", "doyun-hike-1", "hiking", 3, 126, 7, "북한산 능선", {
      distanceKm: 6.42,
      calories: 684,
      elevationGainM: 498,
    }),
    demoMemberWorkout("demo-friend-3", "doyun-hike-2", "hiking", 10, 172, 8, "관악산 종주", {
      distanceKm: 8.76,
      calories: 912,
      elevationGainM: 731,
    }),
  ],
  "demo-friend-4": [
    demoMemberWorkout("demo-friend-4", "yuna-strength-1", "strength", 1, 58, 8, "하체 볼륨 루틴", {
      calories: 428,
      exerciseCount: 5,
      sets: 18,
      volumeKg: 5980,
    }),
    demoMemberWorkout("demo-friend-4", "yuna-swim-1", "swimming", 4, 44, 6, "자유형 1,700m", {
      distanceKm: 1.7,
      distanceM: 1700,
      calories: 418,
      laps: 68,
    }),
    demoMemberWorkout("demo-friend-4", "yuna-strength-2", "strength", 8, 51, 7, "등과 어깨", {
      calories: 376,
      exerciseCount: 5,
      sets: 16,
      volumeKg: 4420,
    }),
  ],
  "demo-friend-private": [],
  "demo-friend-6": [
    demoMemberWorkout("demo-friend-6", "taeo-strength-1", "strength", 2, 62, 8, "상체 볼륨 루틴", {
      calories: 452,
      exerciseCount: 6,
      sets: 18,
      volumeKg: 5840,
    }),
    demoMemberWorkout(
      "demo-friend-6",
      "taeo-hike-1",
      "hiking",
      9,
      104,
      6,
      "사진 없이 남긴 아침 산행",
      {
        distanceKm: 5.38,
        calories: 548,
        elevationGainM: 426,
      },
    ),
  ],
  "demo-friend-7": [
    demoMemberWorkout("demo-friend-7", "seoa-strength-1", "strength", 3, 54, 8, "등과 어깨", {
      calories: 394,
      exerciseCount: 5,
      sets: 16,
      volumeKg: 4680,
    }),
    demoMemberWorkout("demo-friend-7", "seoa-swim-1", "swimming", 9, 42, 7, "아침 자유형", {
      distanceKm: 1.2,
      distanceM: 1200,
      calories: 308,
      laps: 48,
    }),
  ],
  "demo-friend-8": [
    demoMemberWorkout(
      "demo-friend-8",
      "jiyoung-strength-1",
      "strength",
      2,
      57,
      8,
      "하체 집중 루틴",
      {
        calories: 418,
        exerciseCount: 5,
        sets: 18,
        volumeKg: 5220,
      },
    ),
    demoMemberWorkout("demo-friend-8", "jiyoung-strength-2", "strength", 7, 48, 7, "등과 코어", {
      calories: 352,
      exerciseCount: 5,
      sets: 15,
      volumeKg: 3960,
    }),
  ],
};

const deletedWorkoutIds = new Set<string>(
  readStored<string[]>("groov-demo-deleted-workouts-v1", []),
);
const routines = initializeDemoRoutines();
const workouts = initializeDemoWorkouts();
const followingIds = new Set<string>(readStored<string[]>("groov-demo-following-v1", []));
const postShareRecipients = new Map<string, Set<string>>();
const savedFeed = readStored<{ posts: FeedPost[]; archived: FeedPost[] } | null>(
  "groov-demo-feed-v1",
  null,
);
const archived: FeedPost[] = savedFeed?.archived ?? [];
// Refresh demo imagery/copy from the current seeds while preserving local interactions and own posts.
for (const savedPost of savedFeed?.posts ?? []) {
  const seededPost = posts.find((post) => post.id === savedPost.id);
  if (seededPost) {
    seededPost.comments = savedPost.comments;
    seededPost.shareCount = savedPost.shareCount ?? 0;
  } else posts.unshift(savedPost);
}
const messages: DirectMessage[] = [];
const demoReports: ContentReport[] = [];
const demoNotifications: UserNotification[] = [];
let avatarDataUri = readStored<string | undefined>("groov-demo-avatar-v1", undefined);
let demoOnboarding = readStored<OnboardingProfile | null>("groov-demo-onboarding-v1", null);

let activeSession: AuthSession = sessionFor("mvp@groov.demo", "MVP 점검자");
let activeConsent: ConsentState | null = null;

export const demoApi = {
  register: async (input: RegisterInput) => {
    activeSession = sessionFor(input.email, input.displayName);
    demoOnboarding = null;
    persistDemoOnboarding();
    return activeSession;
  },
  login: async (input: LoginInput) => {
    activeSession = sessionFor(input.email, input.email.split("@")[0] || "GROOV 사용자");
    return activeSession;
  },
  googleLogin: async (_input: GoogleLoginInput) => activeSession,
  appleLogin: async (_input: AppleLoginInput) => activeSession,
  kakaoLogin: async (_input: AuthorizationCodeLoginInput) => activeSession,
  naverLogin: async (_input: AuthorizationCodeLoginInput) => activeSession,
  devLogin: async () => activeSession,
  refreshSession: async (_input: RefreshSessionInput) => {
    activeSession = sessionFor(activeSession.user.email, activeSession.user.displayName);
    return activeSession;
  },
  logout: async (_token: string) => ({ loggedOut: true as const }),
  me: async (_token: string) => activeSession.user,
  authProviders: async () => ({
    google: true,
    apple: true,
    kakao: true,
    naver: true,
    development: true,
  }),
  profile: async (_token: string) => ({
    ...activeSession.user,
    ...(avatarDataUri ? { avatarDataUri } : {}),
  }),
  updateProfile: async (_token: string, input: ProfileUpdateInput) => {
    if (input.displayName) {
      activeSession = {
        ...activeSession,
        user: { ...activeSession.user, displayName: input.displayName },
      };
    }
    if (input.avatarDataUri !== undefined) {
      avatarDataUri = input.avatarDataUri ?? undefined;
      persistDemoAvatar();
    }
    return {
      ...activeSession.user,
      ...(avatarDataUri ? { avatarDataUri } : {}),
    };
  },
  onboarding: async (_token: string) => demoOnboarding,
  saveOnboarding: async (_token: string, input: OnboardingInput) => {
    demoOnboarding = { ...input, completedAt: new Date().toISOString() };
    persistDemoOnboarding();
    return demoOnboarding;
  },
  accountSessions: async (_token: string): Promise<AccountSession[]> => [
    {
      id: "demo-session",
      createdAt: new Date(now - 86_400_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      expiresAt: new Date(now + 30 * 86_400_000).toISOString(),
      current: true,
    },
  ],
  revokeAccountSession: async (_token: string, _sessionId: string) => ({
    revoked: true as const,
  }),
  changePassword: async (_token: string, _input: PasswordChangeInput) => activeSession,
  deleteAccount: async (_token: string, _input: AccountDeletionInput) => ({
    deleted: true as const,
  }),
  consent: async (_token: string) => activeConsent,
  updateConsent: async (_token: string, input: ConsentUpdateInput) => {
    activeConsent = { ...input, acceptedAt: new Date().toISOString() };
    return activeConsent;
  },
  createMediaUploadTicket: async (
    _token: string,
    input: MediaUploadRequestInput,
  ): Promise<MediaUploadTicket> => ({
    mediaId: makeId("media"),
    objectPath: `demo/${input.kind}/${makeId("object")}`,
    signedUploadUrl: "https://example.invalid/demo-upload",
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  }),
  completeMediaUpload: async (_token: string, mediaId: string) => ({
    id: mediaId,
    status: "available" as const,
    objectPath: `demo/${mediaId}`,
  }),
  sports: async () => demoSports,
  knowledge: async (sport: SportType) => articleSeeds.filter((item) => item.sport === sport),
  createKnowledgeFeedback: async (
    _token: string,
    articleId: string,
    input: KnowledgeFeedbackCreateInput,
  ) => {
    const item: KnowledgeFeedback = {
      id: makeId("feedback"),
      articleId,
      userId: activeSession.user.id,
      authorDisplayName: activeSession.user.displayName,
      content: input.content,
      ...(input.context ? { context: input.context } : {}),
      createdAt: new Date().toISOString(),
    };
    articleSeeds.find((article) => article.id === articleId)?.feedback.push(item);
    return item;
  },
  feed: async (_token?: string) => {
    await hydratePreviewImages(posts);
    return [...posts]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((post) => decorateDemoPost(post));
  },
  post: async (postId: string, _token?: string) => {
    await hydratePreviewImages(posts);
    const post = posts.find((item) => item.id === postId && !item.archivedAt);
    if (!post) throw new Error("삭제·보관되었거나 볼 수 없는 피드입니다.");
    return decorateDemoPost(post);
  },
  routines: async (_token: string) => routines,
  createRoutine: async (_token: string, input: RoutineCreateInput) => {
    routines.forEach((routine) => {
      routine.sortOrder += 1;
    });
    const item: Routine = {
      id: makeId("routine"),
      userId: activeSession.user.id,
      ...input,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    };
    routines.unshift(item);
    persistDemoState();
    return item;
  },
  updateRoutine: async (_token: string, routineId: string, input: RoutineUpdateInput) => {
    const routine = routines.find((item) => item.id === routineId)!;
    Object.assign(routine, input);
    persistDemoState();
    return routine;
  },
  deleteRoutine: async (_token: string, routineId: string) => {
    const index = routines.findIndex((item) => item.id === routineId);
    if (index >= 0) routines.splice(index, 1);
    routines.forEach((routine, sortOrder) => {
      routine.sortOrder = sortOrder;
    });
    persistDemoState();
    return { deleted: true as const };
  },
  reorderRoutines: async (_token: string, input: RoutineReorderInput) => {
    const ordered = input.routineIds.map((id) => routines.find((routine) => routine.id === id)!);
    routines.splice(0, routines.length, ...ordered);
    routines.forEach((routine, sortOrder) => {
      routine.sortOrder = sortOrder;
    });
    persistDemoState();
    return routines;
  },
  createPost: async (_token: string, input: PostCreateInput, previewMediaUri?: string) => {
    const item: FeedPost = {
      id: makeId("post"),
      userId: activeSession.user.id,
      authorDisplayName: activeSession.user.displayName,
      ...input,
      contentType: input.contentType ?? "post",
      likeCount: 0,
      createdAt: new Date().toISOString(),
      comments: [],
    };
    if (previewMediaUri) item.mediaUrl = await savePreviewImage(item.id, previewMediaUri);
    posts.unshift(item);
    try {
      persistDemoFeed(true);
    } catch (error) {
      posts.splice(posts.indexOf(item), 1);
      await deletePreviewImage(item.mediaUrl);
      throw error;
    }
    return decorateDemoPost(item);
  },
  createComment: async (_token: string, postId: string, input: CommentCreateInput) => {
    const post = posts.find((item) => item.id === postId && !item.archivedAt);
    if (!post) throw new Error("게시물을 찾을 수 없습니다.");
    if (input.parentCommentId) {
      const parent = post.comments.find((item) => item.id === input.parentCommentId);
      if (!parent || parent.parentCommentId)
        throw new Error("답글을 남길 원본 댓글을 찾을 수 없습니다.");
    }
    const comment: FeedPost["comments"][number] = {
      id: makeId("comment"),
      userId: activeSession.user.id,
      authorDisplayName: activeSession.user.displayName,
      content: input.content,
      ...(input.parentCommentId ? { parentCommentId: input.parentCommentId } : {}),
      likeCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    persistDemoFeed();
    return decorateDemoPost(post).comments.find((item) => item.id === comment.id)!;
  },
  setCommentLiked: async (_token: string, postId: string, commentId: string, liked: boolean) => {
    const post = posts.find((item) => item.id === postId && !item.archivedAt);
    const comment = post?.comments.find((item) => item.id === commentId);
    if (!post || !comment) throw new Error("댓글을 찾을 수 없습니다.");
    if (Boolean(comment.likedByMe) !== liked) {
      comment.likeCount = Math.max(0, (comment.likeCount ?? 0) + (liked ? 1 : -1));
      comment.likedByMe = liked;
    }
    persistDemoFeed();
    return decorateDemoPost(post).comments.find((item) => item.id === commentId)!;
  },
  sharePost: async (
    _token: string,
    postId: string,
    selectedIds: string[],
  ): Promise<PostShareResult> => {
    const post = posts.find((candidate) => candidate.id === postId && !candidate.archivedAt);
    if (!post) throw new Error("게시물을 찾을 수 없습니다.");
    const selected = [...new Set(selectedIds)];
    if (
      !selected.length ||
      selected.some((id) => id === activeSession.user.id || !followingIds.has(id))
    )
      throw new Error("현재 팔로잉 중인 사람을 선택해 주세요.");
    const recipients = postShareRecipients.get(postId) ?? new Set<string>();
    const sentIds = selected.filter((id) => !recipients.has(id));
    sentIds.forEach((userId) => {
      recipients.add(userId);
      messages.push({
        id: makeId("share"),
        senderId: activeSession.user.id,
        recipientId: userId,
        content: "피드를 공유했습니다.",
        createdAt: new Date().toISOString(),
        sharedPost: {
          id: post.id,
          authorDisplayName: post.authorDisplayName,
          sport: post.sport,
          content: post.content,
        },
      });
    });
    postShareRecipients.set(postId, recipients);
    post.shareCount = Math.max(post.shareCount ?? 0, recipients.size > 0 ? 1 : 0);
    return { shareCount: post.shareCount, recipientCount: sentIds.length, recipientIds: sentIds };
  },
  workouts: async (_token: string) =>
    workouts.map((workout) => ({ ...workout, metrics: { ...workout.metrics } })),
  createWorkoutSession: async (_token: string, input: WorkoutSessionCreateInput) => {
    const item: WorkoutSession = {
      id: makeId("workout"),
      userId: activeSession.user.id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    workouts.unshift(item);
    try {
      persistDemoState(true);
    } catch (error) {
      workouts.splice(workouts.indexOf(item), 1);
      throw error;
    }
    return item;
  },
  updateWorkoutSession: async (
    _token: string,
    workoutId: string,
    input: WorkoutSessionUpdateInput,
  ) => {
    const workout = workouts.find((item) => item.id === workoutId)!;
    if (input.notes === null) delete workout.notes;
    else if (input.notes !== undefined) workout.notes = input.notes;
    if (input.perceivedExertion !== undefined) {
      workout.perceivedExertion = input.perceivedExertion;
    }
    if (input.metrics !== undefined) workout.metrics = { ...input.metrics };
    persistDemoState();
    return workout;
  },
  deleteWorkoutSession: async (_token: string, workoutId: string) => {
    const index = workouts.findIndex((item) => item.id === workoutId);
    if (index >= 0) workouts.splice(index, 1);
    deletedWorkoutIds.add(workoutId);
    persistDemoState();
    return { deleted: true as const };
  },
  myPosts: async (_token: string) => {
    await hydratePreviewImages(posts);
    return posts
      .filter((post) => post.userId === activeSession.user.id)
      .map((post) => decorateDemoPost(post));
  },
  archivedPosts: async (_token: string) => {
    await hydratePreviewImages(archived);
    return archived.map((post) => decorateDemoPost(post));
  },
  updatePost: async (_token: string, postId: string, input: PostUpdateInput) => {
    const post = [...posts, ...archived].find(
      (item) => item.id === postId && item.userId === activeSession.user.id,
    );
    if (!post) throw new Error("내 게시물만 수정할 수 있습니다.");
    post.content = input.content;
    persistDemoFeed();
    return decorateDemoPost(post);
  },
  archivePost: async (_token: string, postId: string) => {
    const index = posts.findIndex(
      (item) => item.id === postId && item.userId === activeSession.user.id,
    );
    if (index < 0) throw new Error("내 게시물만 보관할 수 있습니다.");
    const post = posts.splice(index, 1)[0]!;
    post.archivedAt = new Date().toISOString();
    archived.unshift(post);
    persistDemoFeed();
    return decorateDemoPost(post);
  },
  restorePost: async (_token: string, postId: string) => {
    const index = archived.findIndex(
      (item) => item.id === postId && item.userId === activeSession.user.id,
    );
    if (index < 0) throw new Error("내 게시물만 복원할 수 있습니다.");
    const post = archived.splice(index, 1)[0]!;
    delete post.archivedAt;
    posts.unshift(post);
    persistDemoFeed();
    return decorateDemoPost(post);
  },
  deletePost: async (_token: string, postId: string) => {
    const source = posts.some((item) => item.id === postId) ? posts : archived;
    const index = source.findIndex(
      (item) => item.id === postId && item.userId === activeSession.user.id,
    );
    if (index < 0) throw new Error("내 게시물만 삭제할 수 있습니다.");
    await deletePreviewImage(source[index]?.mediaUrl);
    source.splice(index, 1);
    postShareRecipients.delete(postId);
    persistDemoFeed();
    return { deleted: true as const };
  },
  userPosts: async (_token: string, userId: string) => {
    await hydratePreviewImages(posts);
    const userPosts = posts.filter((post) => post.userId === userId);
    return {
      user: { id: userId, displayName: userPosts[0]?.authorDisplayName ?? "MOVE 멤버" },
      posts: userPosts.map((post) => decorateDemoPost(post)),
    };
  },
  memberProfile: async (_token: string, userId: string): Promise<PublicMemberProfile> => {
    await hydratePreviewImages(posts);
    const seed = demoMemberDirectory[userId] ?? {
      displayName: "GROOV 멤버",
      isPrivate: false,
      followersCount: 0,
      followingCount: 0,
    };
    const memberWorkouts = demoMemberWorkouts[userId] ?? [];
    const isPrivate = seed.isPrivate;
    return {
      user: { id: userId, displayName: seed.displayName },
      isPrivate,
      followersCount: seed.followersCount + (followingIds.has(userId) ? 1 : 0),
      followingCount: seed.followingCount,
      posts: isPrivate
        ? []
        : posts.filter((post) => post.userId === userId).map((post) => decorateDemoPost(post)),
      workouts: isPrivate ? [] : memberWorkouts,
      medals: isPrivate ? [] : medalsForWorkouts(memberWorkouts),
    };
  },
  socialSummary: async (_token: string): Promise<SocialSummary> => ({
    followersCount: 0,
    followingCount: followingIds.size,
    followers: [],
    following: [...followingIds].map((userId) => ({
      id: userId,
      displayName:
        demoMemberDirectory[userId]?.displayName ??
        posts.find((post) => post.userId === userId)?.authorDisplayName ??
        "GROOV 멤버",
    })),
  }),
  medals: async (_token: string): Promise<Medal[]> => medalsForWorkouts(workouts),
  followStatus: async (_token: string, userId: string) => ({
    following: followingIds.has(userId),
    followersCount:
      (demoMemberDirectory[userId]?.followersCount ?? 0) + (followingIds.has(userId) ? 1 : 0),
  }),
  follow: async (_token: string, userId: string) => {
    followingIds.add(userId);
    persistDemoFollowing();
    return { following: true as const };
  },
  unfollow: async (_token: string, userId: string) => {
    followingIds.delete(userId);
    persistDemoFollowing();
    return { following: false as const };
  },
  removeFollower: async (_token: string, _userId: string) => ({ removed: true as const }),
  blockUser: async (_token: string, userId: string) => {
    followingIds.delete(userId);
    persistDemoFollowing();
    return { blocked: true as const };
  },
  createReport: async (_token: string, input: ContentReportCreateInput) => {
    const timestamp = new Date().toISOString();
    const report: ContentReport = {
      id: makeId("report"),
      reporterId: activeSession.user.id,
      ...input,
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    demoReports.unshift(report);
    return report;
  },
  notifications: async (_token: string) => [...demoNotifications],
  registerPushDevice: async (_token: string, input: { platform: "ios" | "android" }) => ({
    id: "demo-push-device",
    platform: input.platform,
    registeredAt: new Date().toISOString(),
  }),
  unregisterPushDevice: async (_token: string, _pushToken: string) => ({
    unregistered: true as const,
  }),
  markNotificationRead: async (_token: string, notificationId: string) => {
    const notification = demoNotifications.find((item) => item.id === notificationId);
    if (!notification) throw new Error("notification not found");
    notification.readAt ??= new Date().toISOString();
    return { ...notification };
  },
  moderationReports: async (_token: string) => [...demoReports],
  updateModerationReport: async (
    _token: string,
    reportId: string,
    input: ModerationReportUpdateInput,
  ) => {
    const report = demoReports.find((item) => item.id === reportId);
    if (!report) throw new Error("report not found");
    report.status = input.status;
    if (input.resolutionNote === undefined) {
      delete report.resolutionNote;
    } else {
      report.resolutionNote = input.resolutionNote;
    }
    report.updatedAt = new Date().toISOString();
    return { ...report };
  },
  messages: async (_token: string, userId: string) =>
    messages
      .filter(
        (message) =>
          (message.senderId === activeSession.user.id && message.recipientId === userId) ||
          (message.senderId === userId && message.recipientId === activeSession.user.id),
      )
      .map((message) => {
        if (message.sharedPost === undefined) return { ...message };
        const post = posts.find((item) => item.id === message.sharedPost?.id && !item.archivedAt);
        return {
          ...message,
          sharedPost: post
            ? {
                id: post.id,
                authorDisplayName: post.authorDisplayName,
                sport: post.sport,
                content: post.content,
              }
            : null,
        };
      }),
  sendMessage: async (_token: string, userId: string, input: DirectMessageCreateInput) => {
    const message: DirectMessage = {
      id: makeId("message"),
      senderId: activeSession.user.id,
      recipientId: userId,
      content: input.content,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    return message;
  },
};

function article(
  id: string,
  sport: SportType,
  category: string,
  title: string,
  summary: string,
  keyPoints: string[],
  situationalNote: string,
  sourceTitle: string,
  sourceOrganization: string,
  sourceUrl: string,
  feedback: KnowledgeFeedback[] = [],
): KnowledgeArticle {
  return {
    id,
    sport,
    category,
    title,
    summary,
    keyPoints,
    situationalNote,
    reviewStatus: "DRAFT",
    sources: [{ title: sourceTitle, organization: sourceOrganization, url: sourceUrl }],
    safetyNotice,
    feedback,
  };
}

function sessionFor(email: string, displayName: string): AuthSession {
  return {
    accessToken: "public-demo-token",
    refreshToken: "public-demo-refresh-token-that-is-long-enough",
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    user: { id: "demo-user", email, displayName },
  };
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function demoWorkout(
  id: string,
  sport: SportType,
  daysAgo: number,
  durationMinutes: number,
  perceivedExertion: number,
  notes: string,
  metrics: Record<string, number>,
): WorkoutSession {
  const endedAt = new Date(now - daysAgo * 86_400_000 - (daysAgo % 3) * 3_600_000);
  const startedAt = new Date(endedAt.getTime() - durationMinutes * 60_000);
  const averageHeartRateBpm =
    (
      {
        running: 148,
        hiking: 132,
        cycling: 141,
        strength: 128,
        swimming: 136,
        diving: 112,
      } as const
    )[sport] +
    (daysAgo % 5) -
    2;
  const averageCadenceSpm = sport === "running" ? 166 + (daysAgo % 7) : undefined;
  const maximumHeartRateBpm = averageHeartRateBpm + 22 + (daysAgo % 4);
  const hikingSteps =
    sport === "hiking" ? Math.round(Number(metrics.distanceKm ?? 0) * 1380) : undefined;
  const swimLaps = sport === "swimming" ? Number(metrics.laps ?? 0) : 0;
  const swimTotalStrokes = swimLaps > 0 ? Math.round(swimLaps * (17 + (daysAgo % 3))) : 0;
  const swimAverageSwolf =
    swimLaps > 0 ? Math.round((durationMinutes * 60) / swimLaps + swimTotalStrokes / swimLaps) : 0;
  return {
    id: `demo-workout-${id}`,
    userId: "demo-user",
    sport,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    perceivedExertion,
    notes,
    metrics: {
      durationMinutes,
      averageHeartRateBpm,
      maximumHeartRateBpm,
      ...(sport === "hiking" && hikingSteps ? { steps: hikingSteps } : {}),
      ...(sport === "swimming"
        ? {
            totalStrokes: swimTotalStrokes,
            averageSwolf: swimAverageSwolf,
            swimEnvironmentCode: 1,
            poolLengthM: 25,
          }
        : {}),
      ...(sport === "diving"
        ? {
            waterTemperatureC: 25 + (daysAgo % 4),
          }
        : {}),
      ...(sport === "running" && averageCadenceSpm
        ? {
            averageCadenceSpm,
            steps: Math.round(durationMinutes * averageCadenceSpm),
          }
        : {}),
      ...metrics,
    },
    source: "manual",
    createdAt: endedAt.toISOString(),
  };
}

function demoMemberWorkout(
  userId: string,
  id: string,
  sport: SportType,
  daysAgo: number,
  durationMinutes: number,
  perceivedExertion: number,
  notes: string,
  metrics: Record<string, number>,
): WorkoutSession {
  return {
    ...demoWorkout(id, sport, daysAgo, durationMinutes, perceivedExertion, notes, metrics),
    userId,
  };
}

function medalsForWorkouts(source: WorkoutSession[]): Medal[] {
  return sportValues.flatMap((sport) => {
    const count = source.filter((workout) => workout.sport === sport).length;
    return ([1, 10, 30, 100, 250] as const).map((target, index) => ({
      id: `${sport}-${target}`,
      sport,
      title: `${sportLabels[sport]} ${target}회`,
      description: `${sportLabels[sport]} ${target}회 기록`,
      tier: (["newbie", "intermediate", "advanced", "athlete", "instructor"] as const)[index]!,
      earned: count >= target,
      progress: Math.min(count, target),
      target,
      physicalRewardEligible: index >= 3,
    }));
  });
}

function ensureWorkoutCoverage(
  storedWorkouts: WorkoutSession[],
  seeds: WorkoutSession[],
): WorkoutSession[] {
  const merged = [...storedWorkouts];
  const knownIds = new Set(merged.map((workout) => workout.id));

  for (const sport of sportValues) {
    const missingCount = Math.max(
      0,
      3 - merged.filter((workout) => workout.sport === sport).length,
    );
    const missingSeeds = seeds
      .filter((workout) => workout.sport === sport && !knownIds.has(workout.id))
      .slice(0, missingCount);
    merged.push(...missingSeeds);
    missingSeeds.forEach((workout) => knownIds.add(workout.id));
  }

  return merged.sort((left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt));
}

function initializeDemoRoutines(): Routine[] {
  const stored = readStored<Routine[]>("moveall-demo-routines-v2", defaultRoutines);
  try {
    if (!("localStorage" in globalThis)) return stored;
    const versionKey = "groov-demo-routine-seed-version";
    const version = "1";
    if (globalThis.localStorage.getItem(versionKey) === version) return stored;
    const seed = defaultRoutines[0]!;
    const next = [...stored];
    const seedIndex = next.findIndex((routine) => routine.id === seed.id);
    if (seedIndex < 0) {
      next.unshift(seed);
    } else {
      const current = next[seedIndex]!;
      const isLegacySeed = current.items.some((item) =>
        ["전신 워밍업", "기본 전신 운동", "정리 운동"].includes(item.name),
      );
      if (isLegacySeed) next[seedIndex] = seed;
    }
    globalThis.localStorage.setItem("moveall-demo-routines-v2", JSON.stringify(next));
    globalThis.localStorage.setItem(versionKey, version);
    return next;
  } catch {
    return stored;
  }
}

function initializeDemoWorkouts(): WorkoutSession[] {
  const stored = readStored<WorkoutSession[]>("moveall-demo-workouts-v2", []).filter(
    (workout) => !deletedWorkoutIds.has(workout.id),
  );
  const availableSeeds = defaultWorkoutSeeds.filter(
    (workout) => !deletedWorkoutIds.has(workout.id),
  );
  try {
    if (!("localStorage" in globalThis)) {
      return ensureWorkoutCoverage(mergeSeedMetrics(stored, availableSeeds), availableSeeds);
    }
    const seedVersionKey = "groov-demo-workout-seed-version";
    const seedVersion = "5";
    if (globalThis.localStorage.getItem(seedVersionKey) === seedVersion) return stored;
    const seeded = ensureWorkoutCoverage(mergeSeedMetrics(stored, availableSeeds), availableSeeds);
    globalThis.localStorage.setItem("moveall-demo-workouts-v2", JSON.stringify(seeded));
    globalThis.localStorage.setItem(seedVersionKey, seedVersion);
    return seeded;
  } catch {
    return ensureWorkoutCoverage(mergeSeedMetrics(stored, availableSeeds), availableSeeds);
  }
}

function mergeSeedMetrics(stored: WorkoutSession[], seeds: WorkoutSession[]): WorkoutSession[] {
  const seedsById = new Map(seeds.map((seed) => [seed.id, seed]));
  return stored.map((workout) => {
    const seed = seedsById.get(workout.id);
    return seed ? { ...workout, metrics: { ...seed.metrics, ...workout.metrics } } : workout;
  });
}

function readStored<T>(key: string, fallback: T): T {
  try {
    if (!("localStorage" in globalThis)) return fallback;
    const stored = globalThis.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistDemoState(strict = false) {
  try {
    if (!("localStorage" in globalThis)) return;
    globalThis.localStorage.setItem("moveall-demo-routines-v2", JSON.stringify(routines));
    globalThis.localStorage.setItem("moveall-demo-workouts-v2", JSON.stringify(workouts));
    globalThis.localStorage.setItem(
      "groov-demo-deleted-workouts-v1",
      JSON.stringify([...deletedWorkoutIds]),
    );
  } catch {
    if (strict)
      throw new Error(
        "운동 기록을 저장하지 못했습니다. 기기 저장 공간을 확인한 뒤 다시 저장해 주세요.",
      );
    // 저장소를 사용할 수 없는 환경에서는 현재 세션의 메모리 상태를 유지합니다.
  }
}

function persistDemoAvatar() {
  try {
    if (!("localStorage" in globalThis)) return;
    if (avatarDataUri) globalThis.localStorage.setItem("groov-demo-avatar-v1", avatarDataUri);
    else globalThis.localStorage.removeItem("groov-demo-avatar-v1");
  } catch {
    // 저장소를 사용할 수 없는 환경에서는 현재 세션의 프로필 사진을 유지합니다.
  }
}

function persistDemoOnboarding() {
  try {
    if (!("localStorage" in globalThis)) return;
    if (demoOnboarding) {
      globalThis.localStorage.setItem("groov-demo-onboarding-v1", JSON.stringify(demoOnboarding));
    } else {
      globalThis.localStorage.removeItem("groov-demo-onboarding-v1");
    }
  } catch {
    // 저장소를 사용할 수 없는 환경에서는 현재 세션의 온보딩 상태를 유지합니다.
  }
}

function persistDemoFollowing() {
  try {
    if (!("localStorage" in globalThis)) return;
    globalThis.localStorage.setItem("groov-demo-following-v1", JSON.stringify([...followingIds]));
  } catch {
    // 저장소를 사용할 수 없는 환경에서는 현재 세션의 팔로우 상태를 유지합니다.
  }
}

function decorateDemoPost(post: FeedPost): FeedPost {
  const { authorAvatarDataUri: storedAuthorAvatar, comments, ...postWithoutAvatar } = post;
  const resolvedAuthorAvatar =
    post.userId === activeSession.user.id ? avatarDataUri : storedAuthorAvatar;
  return {
    ...postWithoutAvatar,
    ...(post.mediaUrl ? { mediaUrl: previewImageUri(post.mediaUrl) ?? "" } : {}),
    ...(resolvedAuthorAvatar ? { authorAvatarDataUri: resolvedAuthorAvatar } : {}),
    comments: comments.map((comment) => {
      const { authorAvatarDataUri: storedCommentAvatar, ...commentWithoutAvatar } = comment;
      const resolvedCommentAvatar =
        comment.userId === activeSession.user.id ? avatarDataUri : storedCommentAvatar;
      return {
        ...commentWithoutAvatar,
        likeCount: comment.likeCount ?? 0,
        likedByMe: comment.likedByMe ?? false,
        ...(resolvedCommentAvatar ? { authorAvatarDataUri: resolvedCommentAvatar } : {}),
      };
    }),
  };
}

function persistDemoFeed(strict = false) {
  try {
    if (!("localStorage" in globalThis)) return;
    globalThis.localStorage.setItem("groov-demo-feed-v1", JSON.stringify({ posts, archived }));
  } catch {
    if (strict)
      throw new Error(
        "게시물을 저장하지 못했습니다. 기기 저장 공간을 확인한 뒤 다시 시도해 주세요.",
      );
    // Live accounts use PostgreSQL; the preview keeps its current session if browser storage is full.
  }
}
