/** Isolated design fixtures. Never read or write production league standings. */
export const leagueConcepts = [
  {
    id: 1,
    code: "TRACKLINE",
    name: "트랙라인",
    note: "트랙의 선과 큰 순위 숫자. 익숙한 구조 안에 속도감을 더한 안.",
  },
  {
    id: 2,
    code: "RIVAL MATCH",
    name: "라이벌 매치",
    note: "바로 옆 순위와 점수 차이를 전면에. 경쟁이 가장 직관적으로 보이는 안.",
  },
  {
    id: 3,
    code: "SEASON CARD",
    name: "시즌 스코어카드",
    note: "밝은 스코어카드와 정돈된 기록. 내 시즌 성적표처럼 모으고 싶은 안.",
  },
  {
    id: 4,
    code: "NEIGHBORHOOD HEAT",
    name: "동네 열기",
    note: "참여율을 빛나는 눈금으로. 동네가 함께 움직이는 분위기를 강조한 안.",
  },
  {
    id: 5,
    code: "LEAGUE EDITION",
    name: "스포츠 매거진",
    note: "굵은 타이포와 절제된 질감. 그루비의 스포츠 에디토리얼 무드를 살린 안.",
  },
] as const;
export type LeagueConceptId = (typeof leagueConcepts)[number]["id"];
export const leaguePreviewSports = [
  "전체",
  "러닝",
  "등산",
  "근력",
  "사이클",
  "수영",
  "다이빙",
] as const;
export type PreviewPlayer = {
  id: string;
  name: string;
  initials: string;
  points: number;
  count: number;
  mine: boolean;
  rank: number;
};
const names = [
  "MVP 점검자",
  "꾸준한민수",
  "새벽러너",
  "지수의페이스",
  "한강라이더",
  "수영하는윤",
  "산타는도현",
  "모닝무브",
  "오늘도한세트",
  "민트러너",
  "나의템포",
  "준의운동일지",
  "오후라이딩",
  "동네한바퀴",
  "자유형서연",
  "퇴근후운동",
];
const scores = [
  2528, 1907, 1715, 1630, 1548, 1480, 1362, 1210, 1180, 1047, 982, 870, 755, 608, 529, 415,
];

export function leaguePreviewSnapshot(sportIndex = 0, rivalOvertakes = false) {
  const players: PreviewPlayer[] = names.map((name, index) => ({
    id: `league-preview-${index}`,
    name,
    initials: index === 0 ? "M" : name.slice(0, 1),
    points:
      sportIndex === 0
        ? scores[index]!
        : Math.round(scores[index]! * (0.18 + ((index + sportIndex) % 4) * 0.07)),
    count:
      sportIndex === 0
        ? index === 0
          ? 19
          : Math.max(3, 10 - Math.floor(index / 3))
        : Math.max(1, 8 - ((index + sportIndex) % 6)),
    mine: index === 0,
    rank: 0,
  }));
  if (rivalOvertakes) players[1]!.points = Math.max(...players.map((player) => player.points)) + 85;
  players.sort((a, b) => b.points - a.points);
  players.forEach((player, index) => {
    player.rank = index + 1;
  });
  const mine = players.find((player) => player.mine)!;
  const rival = players[mine.rank === 1 ? 1 : mine.rank - 2];
  if (!rival) throw new Error("League preview needs a rival fixture");
  const gap = Math.abs(mine.points - rival.points);
  const start = Math.max(0, Math.min(players.length - 3, mine.rank - 2));
  return {
    players,
    maxPoints: Math.max(...players.map((player) => player.points)),
    mine,
    rival,
    gap,
    nearby: players.slice(start, start + 3),
    members: 19,
    participants: players.length,
    participation: ((players.length / 19) * 100).toFixed(1),
    gapLabel:
      mine.rank === 1
        ? `2위와 ${gap.toLocaleString("ko-KR")}pt 차이`
        : `한 단계 위까지 ${gap.toLocaleString("ko-KR")}pt`,
  };
}
