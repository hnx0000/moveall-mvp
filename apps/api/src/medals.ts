import {
  sportLabels,
  sportValues,
  type Medal,
  type MedalTier,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";

const names: Record<SportType, [string, string, string, string, string]> = {
  strength: ["첫 세트", "철의 루틴", "중량 설계자", "스트렝스 애슬리트", "리프팅 마스터"],
  running: ["첫 발자국", "페이스 메이커", "로드 러너", "러닝 애슬리트", "런 코치"],
  hiking: ["첫 능선", "트레일 탐험가", "정상 수집가", "마운틴 애슬리트", "트레일 가이드"],
  diving: ["첫 입수", "블루 탐험가", "딥 다이버", "다이빙 애슬리트", "다이브 마스터"],
  cycling: ["첫 페달", "로드 헌터", "센추리 빌더", "사이클 애슬리트", "라이드 리더"],
  swimming: ["첫 스트로크", "레인 메이커", "아쿠아 러너", "스윔 애슬리트", "스윔 코치"],
};

const targets = [1, 10, 30, 100, 250] as const;
const tiers: MedalTier[] = ["newbie", "intermediate", "advanced", "athlete", "instructor"];

export function medalsFor(workouts: WorkoutSession[]): Medal[] {
  return sportValues.flatMap((sport) => {
    const sessions = workouts
      .filter((workout) => workout.sport === sport)
      .sort((left, right) => Date.parse(left.endedAt) - Date.parse(right.endedAt));
    return targets.map((target, index) => {
      const earnedAt = sessions[target - 1]?.endedAt;
      const tier = tiers[index]!;
      return {
        id: `${sport}-${target}`,
        sport,
        title: names[sport][index]!,
        description: `${sportLabels[sport]} ${target}회 기록 · ${tierLabel(tier)} 단계`,
        tier,
        earned: sessions.length >= target,
        progress: Math.min(sessions.length, target),
        target,
        physicalRewardEligible: tier === "athlete" || tier === "instructor",
        ...(earnedAt ? { earnedAt } : {}),
      };
    });
  });
}

function tierLabel(tier: MedalTier): string {
  return tier === "newbie"
    ? "뉴비"
    : tier === "intermediate"
      ? "중급자"
      : tier === "advanced"
        ? "상급자"
        : tier === "athlete"
          ? "선수급"
          : "강사급";
}
