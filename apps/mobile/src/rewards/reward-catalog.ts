export type RewardKind = "stamp" | "medal";
export type RewardCategory = "시즌" | "러닝" | "멀티스포츠" | "꾸준함" | "리그" | "기념";

export type RewardDesign = {
  id: string;
  kind: RewardKind;
  name: string;
  mark: string;
  category: RewardCategory;
  condition: string;
  edition: string;
  status: "design" | "ready";
};

const stampRows: Array<[string, string, string, RewardCategory, string]> = [
  ["stamp-first", "FIRST MOVE", "01", "기념", "첫 운동 기록"],
  ["stamp-5k", "5K FINISH", "5K", "러닝", "러닝 5km 완주"],
  ["stamp-10k", "10K BREAK", "10K", "러닝", "러닝 10km 첫 완주"],
  ["stamp-sub60", "SUB 60", "59", "러닝", "10km 60분 이내"],
  ["stamp-half", "HALF", "21.1", "러닝", "하프마라톤 완주"],
  ["stamp-century", "CENTURY RIDE", "100", "멀티스포츠", "사이클 누적 100km"],
  ["stamp-climb", "CLIMB 1K", "1K", "멀티스포츠", "누적 상승고도 1,000m"],
  ["stamp-pool", "POOL 50", "50", "멀티스포츠", "수영 누적 50km"],
  ["stamp-iron", "IRON WEEK", "4X", "멀티스포츠", "주 4회 근력운동"],
  ["stamp-streak7", "7 DAY STREAK", "7", "꾸준함", "7일 연속 운동"],
  ["stamp-streak30", "30 DAY STREAK", "30", "꾸준함", "30일 연속 운동"],
  ["stamp-dawn", "DAWN CLUB", "AM", "꾸준함", "오전 6시 이전 운동 10회"],
  ["stamp-night", "NIGHT CREW", "PM", "꾸준함", "오후 10시 이후 운동 10회"],
  ["stamp-pb", "NEW PB", "PB", "기념", "개인 최고기록 갱신"],
  ["stamp-triple", "TRIPLE SPORT", "3", "멀티스포츠", "한 시즌 3종목 기록"],
  ["stamp-local10", "LOCAL 10", "10", "리그", "동네 리그 TOP 10"],
  ["stamp-leader", "LOCAL LEADER", "#1", "리그", "동네 시즌 1위"],
  ["stamp-season", "SEASON FINISHER", "S9", "시즌", "시즌 목표 100% 달성"],
  ["stamp-comeback", "COMEBACK", "RE", "기념", "30일 휴식 후 복귀 기록"],
  ["stamp-365", "GROOV 365", "365", "기념", "누적 운동 365회"],
];

export const rewardCatalog: RewardDesign[] = stampRows.map(([id, name, mark, category, condition], index) => ({
  id, kind: "stamp" as const, name, mark, category: category as RewardCategory, condition,
  edition: index === 17 ? "SEASON 09" : "CORE 2026", status: index < 5 ? "ready" as const : "design" as const,
}));

export const medalDrafts: RewardDesign[] = [
  { id: "medal-season", kind: "medal", name: "SEASON COMPLETE", mark: "S9", category: "시즌", condition: "시즌 목표 달성", edition: "MEDAL STUDY", status: "design" },
  { id: "medal-pb", kind: "medal", name: "PERSONAL BEST", mark: "PB", category: "기념", condition: "개인 최고기록 갱신", edition: "MEDAL STUDY", status: "design" },
  { id: "medal-local", kind: "medal", name: "LOCAL CHAMPION", mark: "#1", category: "리그", condition: "동네 시즌 1위", edition: "MEDAL STUDY", status: "design" },
  { id: "medal-multi", kind: "medal", name: "MULTI ATHLETE", mark: "3X", category: "멀티스포츠", condition: "3종목 시즌 목표 달성", edition: "MEDAL STUDY", status: "design" },
];
