import { describe, expect, it } from "vitest";
import {
  OnboardingInputSchema,
  UsagePurposeCohortSchema,
  firstUsagePurposeResponse,
  summarizeUsagePurposes,
  usagePurposeOptions,
  usagePurposeValues,
} from "../src/index.js";

const settings = { primarySports: ["running"], activityLevel: "starter", goals: ["consistency"] };

describe("optional primary usage purpose", () => {
  it.each(usagePurposeValues)("accepts %s without changing the rest of onboarding", (purpose) => {
    expect(OnboardingInputSchema.parse({ ...settings, usagePurpose: purpose })).toEqual({
      ...settings,
      usagePurpose: purpose,
    });
  });

  it("keeps explicit skip distinct from an older client that did not collect a response", () => {
    expect(OnboardingInputSchema.parse(settings)).not.toHaveProperty("usagePurpose");
    expect(
      OnboardingInputSchema.parse({ ...settings, usagePurpose: null }).usagePurpose,
    ).toBeNull();
    expect(firstUsagePurposeResponse(null, undefined, "2026-09-03T00:00:00Z")).toEqual({});
    expect(firstUsagePurposeResponse(null, null, "2026-09-03T00:00:00Z")).toEqual({
      usagePurpose: null,
      usagePurposeRecordedAt: "2026-09-03T00:00:00Z",
      usagePurposeQuestionVersion: 1,
    });
  });

  it("rejects unknown, multiple and forged server-only response metadata", () => {
    for (const usagePurpose of ["other", ["record", "social"], 42]) {
      expect(OnboardingInputSchema.safeParse({ ...settings, usagePurpose }).success).toBe(false);
    }
    for (const field of ["usagePurposeQuestionVersion", "usagePurposeRecordedAt"]) {
      expect(OnboardingInputSchema.safeParse({ ...settings, [field]: 1 }).success).toBe(false);
    }
    expect(usagePurposeOptions.map((option) => option.value)).toEqual(usagePurposeValues);
  });

  it.each(["record", null] as const)(
    "preserves first answer %s across repeated settings saves",
    (answer) => {
      const first = firstUsagePurposeResponse(null, answer, "2026-09-03T00:00:00Z");
      for (const next of ["achievement", null, undefined] as const) {
        expect(firstUsagePurposeResponse(first, next, "2026-09-04T00:00:00Z")).toEqual(first);
      }
    },
  );
});

describe("composition, not fabricated personas", () => {
  it("uses only respondents as the type denominator and exposes omissions/exclusions", () => {
    const summary = summarizeUsagePurposes([
      { purpose: "record", collected: true, count: 42 },
      { purpose: "social", collected: true, count: 31 },
      { purpose: "achievement", collected: true, count: 19 },
      { purpose: "competition", collected: true, count: 8 },
      { purpose: null, collected: true, count: 15 },
      { purpose: null, collected: false, count: 10 },
      { purpose: "record", collected: true, count: 3, excluded: true },
    ]);
    expect(summary).toMatchObject({
      totalUsers: 125,
      respondents: 100,
      responseRatePercent: 80,
      skipped: 15,
      uncollected: 10,
      excludedUsers: 3,
    });
    expect(summary.distribution.map((row) => row.percent)).toEqual([42, 31, 8, 19]);
  });

  it("returns no percentage without responses and identifies preview mode", () => {
    const empty = summarizeUsagePurposes([], {}, "preview");
    expect(empty.source).toBe("preview");
    expect(empty.responseRatePercent).toBeNull();
    expect(empty.distribution.every((row) => row.count === 0 && row.percent === null)).toBe(true);
    const skipped = summarizeUsagePurposes([{ purpose: null, collected: true, count: 1 }]);
    expect(skipped.responseRatePercent).toBe(0);
    expect(skipped.distribution.every((row) => row.percent === null)).toBe(true);
  });

  it("validates optional registration bounds and rejects reversed or unknown query fields", () => {
    const registeredFrom = "2026-09-01T00:00:00+09:00";
    const registeredBefore = "2026-10-01T00:00:00+09:00";
    expect(UsagePurposeCohortSchema.parse({ registeredFrom, registeredBefore })).toEqual({
      registeredFrom,
      registeredBefore,
    });
    for (const query of [
      { registeredFrom: "yesterday" },
      { registeredFrom, registeredBefore: registeredFrom },
      { registeredFrom: registeredBefore, registeredBefore: registeredFrom },
      { email: "someone@example.test" },
    ])
      expect(UsagePurposeCohortSchema.safeParse(query).success).toBe(false);
  });
});
