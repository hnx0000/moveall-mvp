import type { KnowledgeArticle, SportSummary } from "@moveall/contracts";
import { sportLabels, sportValues } from "@moveall/contracts";

const heightenedSports = new Set(["diving", "hiking", "swimming"]);

export const sports: SportSummary[] = sportValues.map((id) => ({
  id,
  label: sportLabels[id],
  safetyLevel: heightenedSports.has(id) ? "heightened" : "standard",
  knowledgeReviewStatus: "DRAFT",
}));

type ArticleSeed = Omit<KnowledgeArticle, "feedback">;

const commonSafety =
  "개인의 건강 상태와 환경에 따라 적용 방법이 달라집니다. 통증, 어지럼증, 호흡 곤란 또는 이상 증상이 있으면 운동을 중단하고 자격을 갖춘 전문가에게 상담하세요.";

export const knowledgeArticles: ArticleSeed[] = [
  {
    id: "strength-balanced-foundation",
    sport: "strength",
    title: "처음 만드는 전신 근력운동의 기준",
    category: "입문 · 프로그램",
    summary:
      "큰 근육군을 고르게 사용하고, 현재 가능한 범위에서 점진적으로 부하를 높이는 것이 기본입니다.",
    keyPoints: [
      "다리·엉덩이·등·가슴·복부·어깨·팔 등 주요 근육군을 고르게 포함합니다.",
      "성인은 주요 근육군의 근력운동을 주 2일 이상 수행하는 지침을 참고할 수 있습니다.",
      "한 세트 8~12회도 효과적일 수 있으며, 2~3세트는 더 효과적일 수 있습니다.",
    ],
    situationalNote:
      "처음이거나 오래 쉬었다면 가벼운 저항과 안정적인 동작 범위부터 시작해 반응을 기록하세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Physical Activity Guidelines for Americans, 2nd edition",
        organization: "U.S. Department of Health and Human Services",
        url: "https://odphp.health.gov/sites/default/files/2019-09/Physical_Activity_Guidelines_2nd_edition.pdf",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "strength-progressive-load",
    sport: "strength",
    title: "중량보다 먼저 확인할 세 가지",
    category: "기술 · 부하",
    summary:
      "반복 가능한 자세, 통제 가능한 속도, 회복 상태가 확보된 뒤에 중량이나 횟수를 올립니다.",
    keyPoints: [
      "목표 근육과 관절의 움직임을 통제할 수 있는 범위를 우선합니다.",
      "마지막 반복이 어렵더라도 동작의 질을 유지할 수 있는 부하를 선택합니다.",
      "운동량 증가는 중량·횟수·세트·빈도 중 한 요소씩 관찰하며 조절합니다.",
    ],
    situationalNote:
      "날카로운 통증이나 평소와 다른 관절 증상이 있다면 해당 동작을 중단하고 평가를 받으세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Current Physical Activity Guidelines",
        organization: "Office of Disease Prevention and Health Promotion",
        url: "https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "running-easy-start",
    sport: "running",
    title: "이지런을 시작하는 가장 단순한 방법",
    category: "입문 · 강도",
    summary:
      "처음에는 짧은 걷기와 달리기를 섞고, 대화가 가능한 편안한 강도로 운동 시간을 쌓습니다.",
    keyPoints: [
      "현재 활동량이 적다면 적은 양으로 시작해 시간과 빈도를 서서히 늘립니다.",
      "준비운동과 정리운동으로 강도를 점진적으로 올리고 내립니다.",
      "거리와 속도를 동시에 크게 늘리지 말고 운동 뒤 반응을 기록합니다.",
    ],
    situationalNote:
      "더운 날에는 한낮을 피하고, 강도를 낮추거나 실내 운동으로 바꾸는 선택이 필요할 수 있습니다.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Physical Activity Guidelines for Americans, 2nd edition",
        organization: "U.S. Department of Health and Human Services",
        url: "https://odphp.health.gov/sites/default/files/2019-09/Physical_Activity_Guidelines_2nd_edition.pdf",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "running-heat-safety",
    sport: "running",
    title: "더운 날 러닝의 중단 신호",
    category: "환경 · 더위",
    summary:
      "더운 환경의 운동은 탈수와 온열질환 위험을 높이므로 시간대·강도·동료 관찰을 함께 조절합니다.",
    keyPoints: [
      "가능하면 가장 더운 한낮을 피하고 더 선선한 시간대를 선택합니다.",
      "천천히 시작하고 평소보다 강도를 낮추며 수분을 준비합니다.",
      "실신할 듯하거나 힘이 빠지는 느낌이 들면 즉시 멈추고 시원한 곳으로 이동합니다.",
    ],
    situationalNote: "습도가 높거나 더위에 적응하지 못한 시기에는 평소 기록을 목표로 삼지 마세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Heat and Athletes",
        organization: "U.S. Centers for Disease Control and Prevention",
        url: "https://www.cdc.gov/heat-health/risk-factors/heat-and-athletes.html",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "hiking-ten-essentials",
    sport: "hiking",
    title: "출발 전에 챙기는 10가지 안전 체계",
    category: "장비 · 준비",
    summary:
      "예상치 못한 부상·날씨 변화·지연에 대비해 항법, 보온, 조명, 응급처치, 식수와 비상물품을 준비합니다.",
    keyPoints: [
      "지도·나침반·GPS를 준비하고 사용법을 익히며 휴대전화 외의 대안을 둡니다.",
      "자외선 차단, 여벌 옷, 조명, 응급처치, 불, 도구, 식량, 물, 비상 대피 수단을 점검합니다.",
      "목적지와 귀환 예정 시간을 다른 사람에게 알려 둡니다.",
    ],
    situationalNote:
      "거리·고도 상승·노면·계절과 예보에 따라 기본 장비 외의 추가 장비가 필요합니다.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Ten Essentials",
        organization: "U.S. National Park Service",
        url: "https://www.nps.gov/articles/10essentials.htm",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "hiking-plan-b",
    sport: "hiking",
    title: "날씨와 코스에 맞춘 플랜 B",
    category: "환경 · 코스",
    summary: "코스 난도는 거리만이 아니라 고도 상승, 지형, 날씨를 함께 보고 판단해야 합니다.",
    keyPoints: [
      "출발 직전 공식 기상·탐방로 정보를 다시 확인합니다.",
      "조건이 맞지 않으면 더 짧고 낮은 대체 코스를 미리 정합니다.",
      "일행의 가장 느린 사람과 남은 일몰 시간을 기준으로 돌아설 시점을 정합니다.",
    ],
    situationalNote: "통신이 끊기는 지역에서는 오프라인 지도와 별도의 조명·전원을 준비하세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Trip Planning Guide",
        organization: "U.S. National Park Service",
        url: "https://www.nps.gov/subjects/healthandsafety/trip-planning-guide.htm",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "diving-equalization",
    sport: "diving",
    title: "압력 평형은 통증 전에, 자주, 부드럽게",
    category: "핵심 기술 · 압력",
    summary:
      "하강 중 압력 평형이 되지 않으면 더 내려가지 말고 멈추거나 조금 상승해 다시 시도합니다.",
    keyPoints: [
      "하강 전에 부드럽게 평형을 시작하고 초기 수심에서 자주 반복합니다.",
      "통증은 정상 과정이 아닙니다. 통증이 생기면 상승해 압력을 줄입니다.",
      "평형이 되지 않으면 다이빙을 중단하고, 현기증·청력 변화가 지속되면 진료를 받습니다.",
    ],
    situationalNote:
      "감기·알레르기 등으로 평형이 어렵거나 약물을 고려한다면 다이빙 의학을 아는 의료진과 상의하세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Middle-Ear Equalization",
        organization: "Divers Alert Network",
        url: "https://dan.org/health-medicine/health-resources/diseases-conditions/middle-ear-equalization/",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "diving-fitness-check",
    sport: "diving",
    title: "입수 전 건강·체력 상태 확인",
    category: "건강 · 복귀",
    summary:
      "급성 질환이나 오랜 비활동 뒤에는 다이빙 환경의 요구를 감당할 수 있는지 다시 평가합니다.",
    keyPoints: [
      "감기처럼 압력 평형과 운동 능력에 영향을 주는 급성 질환이 있으면 입수를 미룹니다.",
      "예상 수온·조류·장비 운반 등 현장 요구와 현재 체력을 비교합니다.",
      "질환이나 긴 공백 뒤에는 단계적으로 복귀하고 필요 시 다이빙 의학 평가를 받습니다.",
    ],
    situationalNote:
      "다이빙은 수중에서 즉시 중단·구조가 어렵기 때문에 평소 운동과 다른 보수적 판단이 필요합니다.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Health Status Overview",
        organization: "Divers Alert Network",
        url: "https://dan.org/safety-prevention/return-to-diving-safely/health-status/",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "cycling-road-ready",
    sport: "cycling",
    title: "출발 전 자전거와 헬멧 점검",
    category: "장비 · 도로 안전",
    summary:
      "몸에 맞는 자전거, 작동하는 브레이크, 올바르게 맞춘 헬멧이 모든 라이딩의 출발점입니다.",
    keyPoints: [
      "자전거 크기가 몸에 맞고 타이어와 브레이크가 정상인지 확인합니다.",
      "헬멧은 머리에 수평으로 밀착되고 시야를 가리지 않도록 조정합니다.",
      "도로에서는 예측 가능하게 직선 주행하고 교통 표지와 신호를 따릅니다.",
    ],
    situationalNote:
      "지역의 자전거 도로·보도 주행 법규는 다를 수 있으므로 출발 지역의 규정을 확인하세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Bicycle Safety",
        organization: "U.S. National Highway Traffic Safety Administration",
        url: "https://www.nhtsa.gov/road-safety/bicycle-safety",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "cycling-be-visible",
    sport: "cycling",
    title: "보는 것만큼 보이는 것이 중요합니다",
    category: "환경 · 시인성",
    summary:
      "주간에는 밝은 옷, 어두운 환경에서는 반사 장비와 전·후방 조명을 사용해 다른 도로 이용자가 발견하기 쉽게 합니다.",
    keyPoints: [
      "시야가 나쁘면 흰색 전조등과 적색 후미등, 반사 장비를 함께 사용합니다.",
      "방향 전환 전에 신호를 보내고 갑작스러운 차선 변경을 피합니다.",
      "교차로와 진출입로에서는 차량이 나를 보지 못했다고 가정하고 여유를 둡니다.",
    ],
    situationalNote:
      "조명과 밝은 옷은 안전을 보조하지만 차량과 분리된 안전한 경로 선택을 대신하지 않습니다.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Learn to Bike Safely",
        organization: "U.S. National Highway Traffic Safety Administration",
        url: "https://www.nhtsa.gov/bicycle-safety/learn-bike-safely",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "swimming-water-safety",
    sport: "swimming",
    title: "수영 실력과 별개로 지켜야 할 물 안전",
    category: "안전 · 익수 예방",
    summary:
      "수영 능력이 있어도 자연 수역과 수영장에는 별도의 위험이 있으므로 감독·구명 장비·현장 규칙을 지킵니다.",
    keyPoints: [
      "기초 수영과 물 안전 기술을 배우고 자신의 능력에 맞는 구역을 이용합니다.",
      "자연 수역이나 필요한 활동에서는 몸에 맞는 승인된 구명조끼를 사용합니다.",
      "어린이와 초보자는 구조요원이 있어도 가까이에서 지속적으로 감독합니다.",
    ],
    situationalNote:
      "바다·강·호수는 수온, 조류, 수심 변화와 시야 등 수영장에 없는 변수를 확인해야 합니다.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Guidelines for Healthy and Safe Swimming",
        organization: "U.S. Centers for Disease Control and Prevention",
        url: "https://www.cdc.gov/healthy-swimming/safety/index.html",
      },
    ],
    safetyNotice: commonSafety,
  },
  {
    id: "swimming-pool-health",
    sport: "swimming",
    title: "수영장 이용 전후의 건강 습관",
    category: "위생 · 시설",
    summary: "수질 관리와 개인 위생은 물을 통한 질환 위험을 낮추는 함께 지켜야 할 안전 요소입니다.",
    keyPoints: [
      "입수 전 샤워하고 시설의 수질·안전 안내를 확인합니다.",
      "설사 증상이 있을 때는 수영하지 않고 물을 삼키지 않도록 합니다.",
      "곤란한 수영자를 알아보는 법과 시설의 구조·응급 절차를 확인합니다.",
    ],
    situationalNote:
      "면역이 약하거나 특정 건강 상태가 있다면 이용 전 의료진과 시설 안내를 확인하세요.",
    reviewStatus: "DRAFT",
    sources: [
      {
        title: "Guidelines for Keeping Your Pool Safe and Healthy",
        organization: "U.S. Centers for Disease Control and Prevention",
        url: "https://www.cdc.gov/healthy-swimming/safety/what-you-can-do-to-stay-healthy-in-swimming-pools.html",
      },
    ],
    safetyNotice: commonSafety,
  },
];
