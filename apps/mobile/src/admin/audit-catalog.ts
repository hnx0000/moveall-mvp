export type DeliveryStatus = "ready" | "partial" | "device" | "planned";
export type AuditPriority = "P0" | "P1" | "P2";
export type AppRoute = "/" | "/community" | "/routines" | "/knowledge" | "/profile" | "/admin";

export type PageAudit = {
  id: string;
  title: string;
  route: AppRoute;
  status: DeliveryStatus;
  score: number;
  summary: string;
  working: string[];
  gaps: string[];
  components: string[];
};

export type GapAudit = {
  id: string;
  priority: AuditPriority;
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type FeatureAudit = {
  id: string;
  area: string;
  status: DeliveryStatus;
  behavior: string;
  gap: string;
};

export const pageAudits: PageAudit[] = [
  {
    id: "home",
    title: "홈",
    route: "/",
    status: "partial",
    score: 68,
    summary: "오늘 활동과 실행할 루틴을 빠르게 보여주는 시작 화면",
    working: ["운동 종목 선택", "루틴 단계 체크", "기록 화면 연결", "API 종목 요약"],
    gaps: ["활동 수치가 예시 값", "저장한 루틴과 홈 루틴이 아직 완전히 연결되지 않음"],
    components: ["오늘 활동", "오늘의 루틴", "바로 기록", "스토리 CTA"],
  },
  {
    id: "feed",
    title: "피드",
    route: "/community",
    status: "partial",
    score: 74,
    summary: "운동 기록을 스토리처럼 공유하고 반응하는 커뮤니티",
    working: ["게시물 조회·작성", "댓글 표시", "팔로우·언팔로우 저장", "공개 정보 선택"],
    gaps: ["사진 파일 업로드·영구 저장 미구현", "좋아요·저장이 서버에 저장되지 않음"],
    components: ["스토리", "게시 작성", "피드 카드", "댓글", "공개 범위"],
  },
  {
    id: "record",
    title: "운동 기록",
    route: "/routines",
    status: "device",
    score: 82,
    summary: "GPS 기록, 보행 루트 설계, 인증샷과 기록 합성 스튜디오",
    working: ["GPS 위치 누적", "보행 루트 생성", "사진 선택·촬영", "스토리 레이어 편집"],
    gaps: ["사진 원본은 아직 기기 URI로만 유지", "실기기 백그라운드 GPS 검증 필요"],
    components: ["GPS", "루트 빌더", "카메라", "직접 기록", "스토리 컷"],
  },
  {
    id: "knowledge",
    title: "운동 바이블",
    route: "/knowledge",
    status: "partial",
    score: 76,
    summary: "공개 근거와 상황별 사용자 피드백을 함께 제공하는 지식 화면",
    working: ["종목별 메달 진열", "6개 종목 필터", "근거 출처 연결", "상황 피드백 작성"],
    gaps: ["전문가 승인·버전 관리 워크플로 없음", "북마크가 로컬 화면 상태에만 존재"],
    components: ["종목 필터", "지식 카드", "공식 출처", "상황 피드백"],
  },
  {
    id: "profile",
    title: "내 정보",
    route: "/profile",
    status: "partial",
    score: 93,
    summary: "기록, 게시물, 관계, 메달과 루틴을 관리하는 개인 아카이브",
    working: [
      "프로필 사진·닉네임 편집",
      "운동별 기록 상세",
      "게시물 편집·보관·삭제",
      "팔로워·팔로잉 관리",
      "5단계 메달 진열",
      "루틴 생성·조회",
    ],
    gaps: ["루틴 수정·삭제 미구현", "프로필 사진용 운영 오브젝트 스토리지 필요"],
    components: ["기록 하이라이트", "메달 캐비닛", "게시물", "팔로워·팔로잉", "루틴"],
  },
  {
    id: "admin",
    title: "관리자 도구",
    route: "/admin",
    status: "ready",
    score: 82,
    summary: "페이지 완성도, 실시간 연결 상태, 우선 개선 항목을 통합 점검",
    working: ["페이지 맵", "API 자동 검사", "공백 탐지", "우선순위 추천"],
    gaps: ["운영 배포 전 관리자 역할 기반 접근 제어 필요"],
    components: ["현황판", "자동 검사", "페이지 맵", "공백 큐", "로드맵"],
  },
];

export const featureAudits: FeatureAudit[] = [
  {
    id: "auth",
    area: "계정",
    status: "partial",
    behavior:
      "Google ID 토큰을 서버가 검증하며, 개발 중에는 운영에서 차단되는 전용 세션으로 로그인 화면을 건너뜁니다.",
    gap: "실계정 로그인을 켜려면 앱·API에 Google OAuth 클라이언트 ID를 등록해야 합니다.",
  },
  {
    id: "routine",
    area: "루틴",
    status: "partial",
    behavior: "개인 루틴 생성·조회와 화면 내 실행 체크가 동작합니다.",
    gap: "홈 동기화, 수정, 삭제가 필요합니다.",
  },
  {
    id: "tracking",
    area: "운동 기록",
    status: "device",
    behavior: "GPS 거리·시간과 보행 루트를 계산하고 완료 기록을 서버에 저장합니다.",
    gap: "화면 잠금 중 백그라운드 추적과 오프라인 재시도가 필요합니다.",
  },
  {
    id: "story",
    area: "스토리",
    status: "partial",
    behavior: "사진·지도·경로·문구·점수를 합성하고 공개 범위를 선택합니다.",
    gap: "합성 결과 이미지 업로드와 다른 기기에서의 재생성이 필요합니다.",
  },
  {
    id: "knowledge",
    area: "바이블",
    status: "partial",
    behavior: "공식 출처 기반 콘텐츠와 상황별 피드백을 제공합니다.",
    gap: "전문가 검수 상태, 개정 이력, 신고·모더레이션이 필요합니다.",
  },
  {
    id: "wearables",
    area: "워치",
    status: "planned",
    behavior: "공통 어댑터와 mock 심박 샘플만 존재합니다.",
    gap: "Apple Health, Health Connect, Garmin 실제 커넥터가 필요합니다.",
  },
  {
    id: "rewards",
    area: "보상",
    status: "planned",
    behavior: "화면에서 MOVE SCORE를 계산해 표현합니다.",
    gap: "서버 원장, 부정 기록 방지, 브랜드 할인 정책이 필요합니다.",
  },
  {
    id: "groups",
    area: "크루·커머스",
    status: "planned",
    behavior: "현재 사용자 흐름에는 노출하지 않았습니다.",
    gap: "기록·커뮤니티 루프가 안정된 뒤 별도 MVP로 시작해야 합니다.",
  },
];

export const gapAudits: GapAudit[] = [
  {
    id: "google-oauth-credentials",
    priority: "P0",
    area: "인증",
    title: "Google OAuth 운영 클라이언트 등록",
    evidence:
      "코드와 서버 검증은 구현됐지만 외부 Google Cloud 클라이언트 ID는 저장소에 둘 수 없습니다.",
    recommendation:
      "Web·iOS·Android 클라이언트를 각각 만들고 승인된 리디렉션 URI와 환경변수를 등록하세요.",
  },
  {
    id: "story-media",
    priority: "P0",
    area: "스토리",
    title: "인증샷과 합성 결과의 영구 저장",
    evidence: "현재 사진 URI는 해당 기기의 임시 주소이며 게시물 API에는 텍스트만 저장됩니다.",
    recommendation: "원본 업로드 → 서버 합성 메타데이터 → 썸네일 생성 순서로 구현하세요.",
  },
  {
    id: "admin-rbac",
    priority: "P0",
    area: "보안",
    title: "관리자 역할과 접근 제어",
    evidence: "현재 관리자 화면은 개발 진단용이며 역할 검증이 없습니다.",
    recommendation: "운영 전 사용자 role, 서버 권한 검사, 감사 로그를 함께 추가하세요.",
  },
  {
    id: "expert-review",
    priority: "P1",
    area: "바이블",
    title: "전문가 검수·개정 워크플로",
    evidence: "콘텐츠와 출처는 있으나 누가 언제 검수했는지 추적할 수 없습니다.",
    recommendation: "초안-검수-승인-개정 상태와 전문가 프로필을 데이터 모델에 추가하세요.",
  },
  {
    id: "device-qa",
    priority: "P1",
    area: "GPS·카메라",
    title: "실기기 장시간 테스트",
    evidence: "웹에서 흐름은 검증했지만 화면 잠금·배터리 절약·권한 변경 상황은 미검증입니다.",
    recommendation: "iOS·Android 각각 30분 기록, 앱 전환, 네트워크 단절 시나리오를 자동화하세요.",
  },
  {
    id: "wearable-connectors",
    priority: "P1",
    area: "워치",
    title: "실제 건강 데이터 커넥터",
    evidence: "현재 mock adapter만 구현되어 있습니다.",
    recommendation:
      "HealthKit과 Health Connect부터 시작하고 제조사별 직접 연동은 사용량 이후 결정하세요.",
  },
  {
    id: "growth-expansion",
    priority: "P2",
    area: "확장",
    title: "크루·마일리지·커머스",
    evidence: "데이터 원장과 부정 기록 방지 없이 보상을 먼저 만들면 운영 위험이 큽니다.",
    recommendation: "기록 저장률과 4주 유지율을 확인한 다음 크루, 보상, 브랜드 순으로 확장하세요.",
  },
];

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  ready: "MVP 작동",
  partial: "부분 구현",
  device: "실기기 확인",
  planned: "미구현",
};
