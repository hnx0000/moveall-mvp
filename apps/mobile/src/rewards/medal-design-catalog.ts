import type { SportType } from "@moveall/contracts";

/** Approved archive order. Achievement stages, never athletic skill/certification. */
export const medalGrades = ["bronze", "silver", "gold", "diamond", "platinum", "master"] as const;
export type MedalGrade = (typeof medalGrades)[number];
export type MedalCategory = "activity" | "specialty" | "special";
export type MedalAggregation =
  | "days"
  | "routineWeeks"
  | "totalMeters"
  | "singleMeters"
  | "mountains"
  | "sites"
  | "routineComplete"
  | "programComplete"
  | "strengthPB"
  | "runningPB"
  | "officialHalf"
  | "officialMarathon"
  | "courseComplete"
  | "threeCourses"
  | "returnMonths"
  | "strokes"
  | "poolDive"
  | "seaDive"
  | "education"
  | "scubaLogs"
  | "commuteDays";
export type MedalDefinition = {
  id: string;
  sport: SportType;
  seriesId: string;
  title: string;
  description: string;
  aggregation: MedalAggregation;
  target: number;
  unit: "일" | "주" | "km" | "m" | "곳" | "로그" | "회" | "종";
  applicableActivities: readonly string[];
  requiredData: readonly string[];
  verification: "supported" | "pending-data";
  /** Complete, per-medal sculpted artwork; no shared material plate. */
  assetPath: string;
  optional?: "scuba";
} & (
  | { category: "activity" | "specialty"; stage: number; grade: MedalGrade }
  | { category: "special"; stage: null; grade: null }
);
const labels: Record<SportType, string> = {
  strength: "근력",
  running: "러닝",
  hiking: "산행",
  swimming: "수영",
  diving: "다이빙",
  cycling: "라이딩",
};
const first: Record<SportType, string> = {
  strength: "첫 세트",
  running: "첫 러닝",
  hiking: "첫 산행",
  swimming: "첫 물살",
  diving: "첫 다이빙",
  cycling: "첫 페달",
};
export const medalSportOrder: SportType[] = [
  "strength",
  "running",
  "hiking",
  "swimming",
  "diving",
  "cycling",
];
const supported = new Set<MedalAggregation>(["days", "totalMeters", "singleMeters"]);
const requirements: Record<MedalAggregation, string[]> = {
  days: ["완료 운동 ID", "운동 시작일/시간대"],
  totalMeters: ["중복 제거된 완료 운동", "거리와 출처"],
  singleMeters: ["단일 완료 운동", "거리와 출처"],
  routineWeeks: ["주별 사전 확정 목표 이력", "유효 근력 활동일"],
  mountains: ["검증된 산 고유 ID", "실제 산행 증거"],
  sites: ["시설 단위 장소 고유 ID", "실제 잠수 증거"],
  routineComplete: ["운동 전 저장한 루틴 스냅샷", "예정 항목별 완료 증거"],
  programComplete: ["사전 프로그램", "서로 다른 날짜 4회 이상", "전체 완료 증거"],
  strengthPB: ["동작·장비·중량·반복 수의 비교 가능한 이전/현재 기록"],
  runningPB: ["거리·실내외·기록유형·측정기준이 같은 이전/현재 기록"],
  officialHalf: ["공식 하프 완주 확인"],
  officialMarathon: ["공식 풀 완주 확인"],
  courseComplete: ["산 고유 ID", "등록 코스 완료 검증"],
  threeCourses: ["같은 산의 서로 다른 등록 코스 3개 완료"],
  returnMonths: ["산 고유 ID", "실제 산행 시작 연월 3개"],
  strokes: ["실제 수영 구간별 영법/거리"],
  poolDive: ["풀 유형", "실제 잠수 기록"],
  seaDive: ["바다 유형", "실제 잠수 기록"],
  education: ["강사 지도 교육 참여 확인"],
  scubaLogs: ["프리/스쿠바 유형", "중복·분할을 묶는 잠수 고유 ID"],
  commuteDays: ["실외 여부", "생활 이동 목적", "활동 시작일"],
};
function define(
  sport: SportType,
  seriesId: string,
  category: MedalCategory,
  suffix: string,
  title: string,
  target: number,
  unit: MedalDefinition["unit"],
  aggregation: MedalAggregation,
  stage: number,
  description: string,
  optional?: "scuba",
): MedalDefinition {
  const id = `${sport}_${suffix}`;
  return {
    id,
    sport,
    seriesId: `${sport}_${seriesId}`,
    title,
    description,
    ...(category === "special"
      ? { category, stage: null, grade: null }
      : { category, stage, grade: medalGrades[stage - 1]! }),
    aggregation,
    target,
    unit,
    applicableActivities: optional ? ["scuba"] : [sport],
    requiredData: requirements[aggregation],
    verification: supported.has(aggregation) ? "supported" : "pending-data",
    assetPath: `assets/images/medal-sculpted/${id}.png`,
    ...(optional ? { optional } : {}),
  };
}
const activity = medalSportOrder.flatMap((sport) =>
  [1, 5, 10, 30, 50, 100].map((n, i) =>
    define(
      sport,
      "days",
      "activity",
      `days_${n}`,
      n === 1 ? first[sport] : `${labels[sport]} ${n}일`,
      n,
      "일",
      "days",
      i + 1,
      `${labels[sport]} 누적 운동일 ${n}일. 같은 종목·같은 시작일은 1일이며 연속일이 아닙니다.`,
    ),
  ),
);
const specialtySpecs: Array<
  [SportType, string, number[], string, MedalDefinition["unit"], MedalAggregation, string]
> = [
  [
    "strength",
    "routine_weeks",
    [1, 2, 4, 8, 12, 24],
    "루틴",
    "주",
    "routineWeeks",
    "미리 확정한 주간 근력 운동일 목표를 충족한 누적 주. 목표 변경은 다음 주부터 적용하며 과거를 소급하지 않습니다.",
  ],
  [
    "running",
    "total_km",
    [10, 50, 100, 300, 500, 1000],
    "누적 러닝",
    "km",
    "totalMeters",
    "실제 러닝 거리 누적. 실내 거리도 출처를 보존해 인정하며 다른 종목은 합산하지 않습니다.",
  ],
  [
    "hiking",
    "unique_mountains",
    [1, 3, 5, 10, 20, 30],
    "산 탐험",
    "곳",
    "mountains",
    "실제 산행한 서로 다른 산의 고유 ID 수. 정상은 필수가 아니며 입구 체크인만으로 인정하지 않습니다.",
  ],
  [
    "swimming",
    "total_km",
    [1, 5, 10, 25, 50, 100],
    "누적 수영",
    "km",
    "totalMeters",
    "실제 수영 거리 누적. 풀 길이 × 실제 편도 이동 횟수이며 휴식·시간을 거리로 환산하지 않습니다.",
  ],
  [
    "diving",
    "unique_sites",
    [1, 3, 5, 10, 15, 20],
    "다이브 스폿",
    "곳",
    "sites",
    "실제 잠수한 서로 다른 시설·장소 ID 수. 같은 시설의 수심 구역과 프리/스쿠바는 하나로 합칩니다.",
  ],
  [
    "cycling",
    "total_km",
    [50, 100, 300, 500, 1000, 3000],
    "누적 라이딩",
    "km",
    "totalMeters",
    "실제 사이클 거리 누적. 생활 이동과 거리 데이터가 있는 실내 사이클을 출처와 함께 인정합니다.",
  ],
];
const specialty = specialtySpecs.flatMap(
  ([sport, key, steps, name, unit, aggregation, description]) =>
    steps.map((n, i) =>
      define(
        sport,
        key,
        "specialty",
        `${key}_${n}`,
        `${name} ${n.toLocaleString("en-US")}${unit}`,
        n,
        unit,
        aggregation,
        i + 1,
        description,
      ),
    ),
);
function special(
  sport: SportType,
  key: string,
  title: string,
  target: number,
  unit: MedalDefinition["unit"],
  agg: MedalAggregation,
  description: string,
  optional?: "scuba",
) {
  return define(sport, key, "special", key, title, target, unit, agg, 0, description, optional);
}
const specials: MedalDefinition[] = [
  special(
    "strength",
    "first_routine",
    "첫 루틴 완주",
    1,
    "회",
    "routineComplete",
    "운동 전에 저장한 루틴의 예정 운동 항목을 모두 완료.",
  ),
  special(
    "strength",
    "first_program",
    "첫 프로그램 완주",
    1,
    "회",
    "programComplete",
    "서로 다른 날짜의 운동 4회 이상으로 구성된 사전 프로그램 전체 완료.",
  ),
  special(
    "strength",
    "first_pb",
    "첫 개인 기록 갱신",
    1,
    "회",
    "strengthPB",
    "같은 동작·장비·반복 수에서 중량 증가 또는 같은 동작·장비·중량에서 반복 수 증가. 이전 유효 기록 필수.",
  ),
  ...[3, 5, 10, 15].map((n) =>
    special(
      "running",
      `single_km_${n}`,
      `첫 ${n}km`,
      n,
      "km",
      "singleMeters",
      `한 번의 러닝에서 ${n}km 달성. 누적 거리를 합치지 않습니다.`,
    ),
  ),
  special(
    "running",
    "official_half",
    "첫 하프마라톤 완주",
    1,
    "회",
    "officialHalf",
    "공식 하프마라톤 완주 확인. 신청·배번호·누적 거리만으로 지급하지 않습니다.",
  ),
  special(
    "running",
    "official_marathon",
    "첫 풀마라톤 완주",
    1,
    "회",
    "officialMarathon",
    "공식 풀마라톤 완주 확인. 신청·배번호·누적 거리만으로 지급하지 않습니다.",
  ),
  special(
    "running",
    "first_pb",
    "첫 개인 기록 갱신",
    1,
    "회",
    "runningPB",
    "같은 거리·기록 유형·시간 측정 기준·실내외 조건에서 이전 유효 기록 단축.",
  ),
  special(
    "hiking",
    "first_course",
    "첫 코스 완주",
    1,
    "회",
    "courseComplete",
    "등록 산행 코스의 완료 조건을 충족.",
  ),
  special(
    "hiking",
    "three_courses",
    "한 산, 세 코스",
    3,
    "회",
    "threeCourses",
    "같은 산의 서로 다른 등록 코스 3개 완료.",
  ),
  special(
    "hiking",
    "return_months",
    "다시 만난 산",
    3,
    "회",
    "returnMonths",
    "같은 산을 서로 다른 연월 3개에 실제 산행. 연속 월일 필요는 없습니다.",
  ),
  special(
    "hiking",
    "total_km_100",
    "산길 100km",
    100,
    "km",
    "totalMeters",
    "실제 산행 거리 누적 100km.",
  ),
  ...[250, 500, 1000, 1500, 2000, 3000].map((n) =>
    special(
      "swimming",
      `single_m_${n}`,
      `첫 ${n.toLocaleString("en-US")}m 세션`,
      n,
      "m",
      "singleMeters",
      `한 번의 수영 운동 총거리 ${n.toLocaleString("en-US")}m. 중간 휴식 허용, 연속 수영 조건이 아닙니다.`,
    ),
  ),
  special(
    "swimming",
    "three_strokes",
    "세 가지 영법",
    3,
    "종",
    "strokes",
    "실제 수영 구간에 기록된 서로 다른 영법 3가지. 여러 운동 누적 가능하며 태그만으로는 인정하지 않습니다.",
  ),
  special(
    "diving",
    "first_pool",
    "첫 풀 다이빙",
    1,
    "회",
    "poolDive",
    "다이빙 풀의 첫 실제 잠수 활동.",
  ),
  special(
    "diving",
    "first_sea",
    "첫 바다 다이빙",
    1,
    "회",
    "seaDive",
    "바다에서 첫 실제 잠수 활동.",
  ),
  special(
    "diving",
    "first_education",
    "첫 교육 참여",
    1,
    "회",
    "education",
    "강사 지도 교육 참여 확인. 참여 기념이며 자격 인증이 아닙니다.",
  ),
  ...[10, 25, 50, 100].map((n) =>
    special(
      "diving",
      `scuba_logs_${n}`,
      `스쿠바 ${n}로그`,
      n,
      "로그",
      "scubaLogs",
      `실제 스쿠바 잠수 ${n}회. 같은 잠수의 중복·분할은 하나, 프리다이빙은 제외.`,
      "scuba",
    ),
  ),
  ...[10, 20, 50, 100].map((n) =>
    special(
      "cycling",
      `single_km_${n}`,
      `첫 ${n}km 라이딩`,
      n,
      "km",
      "singleMeters",
      `한 번의 사이클 운동 ${n}km. 별도 출퇴근 운동을 합치지 않습니다.`,
    ),
  ),
  ...[10, 30].map((n) =>
    special(
      "cycling",
      `commute_days_${n}`,
      `일상 라이더 ${n}일`,
      n,
      "일",
      "commuteDays",
      `출퇴근·등하교·생활 이동 목적의 실외 자전거 누적 ${n}일. 같은 날은 1일이며 주소 공개는 필요 없습니다.`,
    ),
  ),
];
export const medalDefinitions: readonly MedalDefinition[] = [
  ...activity,
  ...specialty,
  ...specials,
];
export const medalDefinitionById = Object.fromEntries(
  medalDefinitions.map((d) => [d.id, d]),
) as Record<string, MedalDefinition>;
