import { z } from "zod";

export const usagePurposeValues = ["record", "social", "competition", "achievement"] as const;
export const UsagePurposeSchema = z.enum(usagePurposeValues);
export type UsagePurpose = z.infer<typeof UsagePurposeSchema>;
export const usagePurposeOptions = [
  { value: "record", label: "순수 기록형", answer: "내 운동을 기록하고 싶어요" },
  { value: "social", label: "기록 + SNS형", answer: "기록을 공유하고 사람들과 소통하고 싶어요" },
  { value: "competition", label: "경쟁형", answer: "다른 사람과 경쟁하며 운동하고 싶어요" },
  { value: "achievement", label: "개인 성취형", answer: "나만의 목표와 성취를 모으고 싶어요" },
] as const satisfies ReadonlyArray<{ value: UsagePurpose; label: string; answer: string }>;
export const USAGE_PURPOSE_QUESTION_VERSION = 1;
export type UsagePurposeResponse = {
  usagePurpose?: UsagePurpose | null;
  usagePurposeRecordedAt?: string;
  usagePurposeQuestionVersion?: number;
};

/** Preserve the first completed signup answer, including explicit skip, across settings edits. */
export function firstUsagePurposeResponse(
  previous: UsagePurposeResponse | null | undefined,
  answer: UsagePurpose | null | undefined,
  now: string,
): UsagePurposeResponse {
  if (previous?.usagePurposeRecordedAt)
    return {
      usagePurpose: previous.usagePurpose ?? null,
      usagePurposeRecordedAt: previous.usagePurposeRecordedAt,
      usagePurposeQuestionVersion:
        previous.usagePurposeQuestionVersion ?? USAGE_PURPOSE_QUESTION_VERSION,
    };
  if (answer === undefined) return {};
  return {
    usagePurpose: answer,
    usagePurposeRecordedAt: now,
    usagePurposeQuestionVersion: USAGE_PURPOSE_QUESTION_VERSION,
  };
}

export const UsagePurposeCohortSchema = z
  .object({
    registeredFrom: z.iso.datetime({ offset: true }).optional(),
    registeredBefore: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (range) =>
      !range.registeredFrom ||
      !range.registeredBefore ||
      Date.parse(range.registeredFrom) < Date.parse(range.registeredBefore),
    "가입 기간의 시작은 종료보다 앞이어야 합니다.",
  );
export type UsagePurposeCohort = z.infer<typeof UsagePurposeCohortSchema>;
export type UsagePurposeBucket = {
  purpose: UsagePurpose | null;
  collected: boolean;
  count: number;
  excluded?: boolean;
};
export type UsagePurposeSummary = {
  source: "registered_users" | "preview";
  questionVersion: number;
  cohort: UsagePurposeCohort;
  generatedAt: string;
  totalUsers: number;
  excludedUsers: number;
  respondents: number;
  skipped: number;
  uncollected: number;
  responseRatePercent: number | null;
  distribution: Array<{
    purpose: UsagePurpose;
    label: string;
    count: number;
    percent: number | null;
  }>;
};
export function summarizeUsagePurposes(
  buckets: UsagePurposeBucket[],
  cohort: UsagePurposeCohort = {},
  source: UsagePurposeSummary["source"] = "registered_users",
): UsagePurposeSummary {
  const counts = new Map<UsagePurpose, number>(usagePurposeValues.map((purpose) => [purpose, 0]));
  let skipped = 0,
    uncollected = 0,
    excludedUsers = 0;
  for (const bucket of buckets) {
    if (bucket.excluded) {
      excludedUsers += bucket.count;
      continue;
    }
    if (!bucket.collected) uncollected += bucket.count;
    else if (bucket.purpose === null) skipped += bucket.count;
    else counts.set(bucket.purpose, (counts.get(bucket.purpose) ?? 0) + bucket.count);
  }
  const respondents = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const totalUsers = respondents + skipped + uncollected;
  const percent = (count: number, total: number) =>
    total ? Math.round((count / total) * 1000) / 10 : null;
  return {
    source,
    cohort,
    questionVersion: USAGE_PURPOSE_QUESTION_VERSION,
    generatedAt: new Date().toISOString(),
    totalUsers,
    excludedUsers,
    respondents,
    skipped,
    uncollected,
    responseRatePercent: percent(respondents, totalUsers),
    distribution: usagePurposeOptions.map((option) => ({
      purpose: option.value,
      label: option.label,
      count: counts.get(option.value) ?? 0,
      percent: percent(counts.get(option.value) ?? 0, respondents),
    })),
  };
}
