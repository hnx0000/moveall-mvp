export const sports = {
  running: {
    name: "러닝",
    en: "RUNNING",
    icon: "run",
    unit: "km",
    amount: 5,
    total: 32,
    target: 50,
    label: "월간 거리",
    time: 30,
    hero: "instagram/story-run-track.jpg",
    title: "속도보다 꾸준함.",
    action: "가볍게 5km",
    route: "강변 리커버리 루프",
    routeInfo: "5.0km · 평지 · 순환 코스",
    goal: "이번 달 50km",
    medal: "첫 50km",
    people: ["민지", "준", "서윤"],
    crew: "오전 7시 러너스",
    feed: "빠르지 않아도, 어제보다 한 번 더.",
    record: "5.20 km",
    metric: "6′03″ /km",
    challenge: "주간 20km 릴레이",
  },
  cycling: {
    name: "사이클",
    en: "CYCLING",
    icon: "bike",
    unit: "km",
    amount: 20,
    total: 72,
    target: 150,
    label: "월간 거리",
    time: 60,
    hero: "story-cycling-01.jpg",
    title: "두 바퀴, 더 먼 세상.",
    action: "평지 20km 라이딩",
    route: "리버사이드 라이드",
    routeInfo: "20km · 평지 · 왕복 코스",
    goal: "이번 달 150km",
    medal: "센추리의 시작",
    people: ["지호", "수민", "현"],
    crew: "선데이 페달 클럽",
    feed: "같은 강도 반대 방향이면 새로운 길.",
    record: "31.40 km",
    metric: "24.8 km/h",
    challenge: "주말 100km 함께 타기",
  },
  hiking: {
    name: "등산",
    en: "HIKING",
    icon: "mountain",
    unit: "회",
    amount: 1,
    total: 1,
    target: 3,
    label: "새로운 산",
    time: 90,
    hero: "instagram/story-hike-overlook.jpg",
    title: "한 걸음 위의 풍경.",
    action: "완만한 능선 걷기",
    route: "숲길 전망 순환 코스",
    routeInfo: "4.2km · 상승 280m · 샘플",
    goal: "새로운 산 3곳",
    medal: "세 개의 정상",
    people: ["도윤", "하늘", "지민"],
    crew: "느린 산책 등산부",
    feed: "정상에서 잠깐 멈추면 보이는 것들.",
    record: "6.80 km",
    metric: "상승 420m",
    challenge: "이번 달 3개 봉우리",
  },
  swimming: {
    name: "수영",
    en: "SWIMMING",
    icon: "waves",
    unit: "m",
    amount: 500,
    total: 2500,
    target: 5000,
    label: "월간 거리",
    time: 25,
    hero: "instagram/story-pool-lane.jpg",
    title: "물속에서 나의 리듬.",
    action: "자유형 500m",
    route: "25m 풀 · 20레인 왕복",
    routeInfo: "25m × 20 · 자유형 중심",
    goal: "이번 달 5,000m",
    medal: "물속의 5K",
    people: ["유진", "다은", "민"],
    crew: "출근 전 한 레인",
    feed: "호흡 하나, 스트로크 하나에 집중.",
    record: "1,000 m",
    metric: "2′20″ /100m",
    challenge: "크루 누적 10,000m",
  },
  strength: {
    name: "헬스",
    en: "STRENGTH",
    icon: "dumbbell",
    unit: "회",
    amount: 1,
    total: 5,
    target: 12,
    label: "월간 운동",
    time: 40,
    hero: "instagram/story-strength-gym.jpg",
    title: "어제의 나를 넘는 힘.",
    action: "전신 루틴 40분",
    route: "전신 A · 4가지 움직임",
    routeInfo: "스쿼트 · 로우 · 프레스 · 코어",
    goal: "이번 달 운동 12회",
    medal: "꾸준함의 무게",
    people: ["유나", "태오", "지영"],
    crew: "한 세트 더",
    feed: "무게보다, 오늘도 왔다는 사실.",
    record: "18 sets",
    metric: "총 볼륨 3,240kg",
    challenge: "주 3회 출석 챌린지",
  },
  diving: {
    name: "프리다이빙",
    en: "FREEDIVING",
    icon: "waves",
    unit: "회",
    amount: 1,
    total: 2,
    target: 6,
    label: "버디 세션",
    time: 45,
    hero: "instagram/story-dive-line.jpg",
    title: "깊이보다 편안한 호흡.",
    action: "버디와 풀 세션",
    route: "버디 풀 세션 구성",
    routeInfo: "버디 확인 · 풀 연습 · 회복 기록",
    goal: "버디 세션 6회",
    medal: "함께한 여섯 번",
    people: ["해인", "시우", "나래"],
    crew: "블루 버디스",
    feed: "오늘도 버디와 함께, 편안한 세션.",
    record: "풀 세션 45분",
    metric: "버디 1명 동행",
    challenge: "버디 동행 4회 기록",
  },
};
export const concepts = {
  today: {
    name: "TODAY",
    number: "01",
    title: "“오늘 뭘 하지?”에 답하기.",
    desc: "종목보다 오늘 할 행동이 먼저. 작은 추천 하나에서 실제 운동과 성취로 이어집니다.",
    steps: [
      "추천 운동을 눌러 세션을 시작하세요.",
      "체험 완료 후 주간 진행도를 확인하세요.",
      "미션에 참여하고 다음 행동을 찾아보세요.",
    ],
  },
  sport: {
    name: "SPORT",
    number: "02",
    title: "내 운동의 세계로 들어가기.",
    desc: "기록부터 메달, 루트, 사람까지. 같은 운동을 한다는 이유로 다시 찾는 종목별 허브입니다.",
    steps: [
      "러닝에서 수영·헬스 등으로 바꿔보세요.",
      "각 종목의 기록·성취·루틴·크루를 열어보세요.",
      "목표 하나를 선택하고 세션을 시작하세요.",
    ],
  },
  hybrid: {
    name: "TODAY × SPORT",
    number: "03",
    title: "내 종목에서, 오늘 한 걸음.",
    desc: "종목의 깊이는 유지하고 첫 행동은 명확하게. 오늘의 추천 아래로 나의 운동 세계가 이어집니다.",
    steps: [
      "상단에서 관심 종목을 바꿔보세요.",
      "선택한 종목의 오늘 추천을 시작하세요.",
      "목표와 기록이 함께 바뀌는지 확인하세요.",
    ],
  },
};
export const personas = [
  ["record", "기록형", "내 기록을 쌓고 변화를 확인할 수 있나?"],
  ["social", "SNS형", "사람과 콘텐츠를 통해 다시 방문할 이유가 있나?"],
  ["competition", "경쟁형", "비교하고 도전할 상대·기준이 있나?"],
  ["achievement", "성취형", "목표와 달성의 보상이 분명한가?"],
];
export const initialState = () => ({
  version: 1,
  sessions: [],
  joined: [],
  following: [],
  goals: {},
  reviews: {},
  chosen: null,
});
export function loadState(raw) {
  try {
    const p = JSON.parse(raw);
    if (
      p?.version === 1 &&
      Array.isArray(p.sessions) &&
      Array.isArray(p.joined) &&
      Array.isArray(p.following) &&
      p.goals &&
      p.reviews
    )
      return p;
  } catch {}
  return initialState();
}
export function progress(state, sport) {
  const s = sports[sport];
  return {
    total:
      s.total + state.sessions.filter((x) => x.sport === sport).reduce((a, x) => a + x.amount, 0),
    target: state.goals[sport] || s.target,
  };
}
export function completeSession(state, session) {
  if (
    !sports[session.sport] ||
    !Number.isFinite(session.amount) ||
    session.amount <= 0 ||
    state.sessions.some((x) => x.id === session.id)
  )
    return state;
  return { ...state, sessions: [...state.sessions, session] };
}
export function toggle(items, id) {
  return items.includes(id) ? items.filter((x) => x !== id) : [...items, id];
}
