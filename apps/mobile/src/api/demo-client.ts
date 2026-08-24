import {
  sportLabels,
  sportValues,
  type AuthSession,
  type FeedPost,
  type KnowledgeArticle,
  type KnowledgeFeedback,
  type KnowledgeFeedbackCreateInput,
  type LoginInput,
  type PostCreateInput,
  type RegisterInput,
  type Routine,
  type RoutineCreateInput,
  type SportSummary,
  type SportType,
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
    createdAt: new Date(now - 2 * 60 * 60_000).toISOString(),
    comments: [
      {
        id: "demo-comment-1",
        userId: "demo-friend-2",
        authorDisplayName: "페이스메이커 준",
        content: "꾸준한 이지런이 가장 강한 기반이에요!",
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
    createdAt: new Date(now - 4 * 60 * 60_000).toISOString(),
    comments: [],
  },
];

const routines: Routine[] = [
  {
    id: "demo-routine-strength",
    userId: "demo-user",
    title: "월수금 전신 루틴",
    sport: "strength",
    daysOfWeek: [1, 3, 5],
    items: [
      { name: "전신 워밍업", target: "5분", order: 0 },
      { name: "기본 전신 운동", target: "30분", order: 1 },
      { name: "정리 운동", target: "5분", order: 2 },
    ],
    createdAt: new Date(now - 7 * 86_400_000).toISOString(),
  },
];

let activeSession: AuthSession = sessionFor("mvp@moveall.demo", "MVP 점검자");

export const demoApi = {
  register: async (input: RegisterInput) => {
    activeSession = sessionFor(input.email, input.displayName);
    return activeSession;
  },
  login: async (input: LoginInput) => {
    activeSession = sessionFor(input.email, input.email.split("@")[0] || "MoveAll 사용자");
    return activeSession;
  },
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
  feed: async () => posts,
  routines: async (_token: string) => routines,
  createRoutine: async (_token: string, input: RoutineCreateInput) => {
    const item: Routine = {
      id: makeId("routine"),
      userId: activeSession.user.id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    routines.unshift(item);
    return item;
  },
  createPost: async (_token: string, input: PostCreateInput) => {
    const item: FeedPost = {
      id: makeId("post"),
      userId: activeSession.user.id,
      authorDisplayName: activeSession.user.displayName,
      ...input,
      createdAt: new Date().toISOString(),
      comments: [],
    };
    posts.unshift(item);
    return item;
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
    user: { id: "demo-user", email, displayName },
  };
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
