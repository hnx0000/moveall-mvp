import { beforeEach, describe, expect, it, vi } from "vitest";
import { type OnboardingInput } from "@moveall/contracts";
import { PostgresStore } from "../src/infrastructure/postgres-store.js";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    query = query;
  },
}));

const settings: OnboardingInput = {
  primarySports: ["running"],
  activityLevel: "starter",
  goals: ["consistency"],
};
const row = {
  user_id: "test-user",
  primary_sports: settings.primarySports,
  activity_level: "starter",
  goals: settings.goals,
  neighborhood: null,
  latitude: null,
  longitude: null,
  neighborhood_verified_at: null,
  completed_at: new Date("2026-09-03T00:00:00Z"),
  usage_purpose: null,
  usage_purpose_recorded_at: null,
  usage_purpose_question_version: null,
};
const store = () => new PostgresStore("postgres://test-only.invalid/not-connected");
beforeEach(() => query.mockReset());

// Query/mapping contract tests. No connection to a live or production PostgreSQL database.
describe("PostgreSQL signup-purpose query contracts", () => {
  it("binds explicit skip differently from omitted input and preserves the first answer atomically", async () => {
    query.mockResolvedValue({ rows: [row] });
    await store().saveOnboarding("test-user", settings);
    expect(query.mock.calls[0]![1].slice(-2)).toEqual([null, false]);
    query.mockResolvedValue({
      rows: [
        { ...row, usage_purpose_recorded_at: row.completed_at, usage_purpose_question_version: 1 },
      ],
    });
    const skipped = await store().saveOnboarding("test-user", { ...settings, usagePurpose: null });
    expect(query.mock.calls[1]![1].slice(-2)).toEqual([null, true]);
    expect(skipped.usagePurpose).toBeNull();
    expect(skipped.usagePurposeRecordedAt).toBe(row.completed_at.toISOString());
    const sql = query.mock.calls[1]![0] as string;
    expect(sql).toContain("ON CONFLICT (user_id) DO UPDATE");
    expect(sql).toContain(
      "CASE WHEN user_onboarding.usage_purpose_recorded_at IS NOT NULL THEN user_onboarding.usage_purpose ELSE EXCLUDED.usage_purpose END",
    );
    expect(sql).toContain(
      "COALESCE(user_onboarding.usage_purpose_recorded_at, EXCLUDED.usage_purpose_recorded_at)",
    );
  });

  it("maps stored responses after a fresh store instance and leaves legacy rows unclassified", async () => {
    query.mockResolvedValue({
      rows: [
        {
          ...row,
          usage_purpose: "social",
          usage_purpose_recorded_at: row.completed_at,
          usage_purpose_question_version: 1,
        },
      ],
    });
    expect(await store().getOnboarding("test-user")).toMatchObject({
      usagePurpose: "social",
      usagePurposeQuestionVersion: 1,
    });
    query.mockResolvedValue({ rows: [row] });
    expect(await store().getOnboarding("test-user")).not.toHaveProperty("usagePurpose");
  });

  it("aggregates on the server with bound registration dates and no per-user projection", async () => {
    query.mockResolvedValue({
      rows: [
        { purpose: "record", collected: true, excluded: false, count: 2 },
        { purpose: null, collected: true, excluded: false, count: 1 },
        { purpose: null, collected: false, excluded: false, count: 3 },
        { purpose: "social", collected: true, excluded: true, count: 1 },
      ],
    });
    const cohort = {
      registeredFrom: "2026-09-01T00:00:00Z",
      registeredBefore: "2026-10-01T00:00:00Z",
    };
    expect(await store().usagePurposeSummary(cohort, ["ADMIN@EXAMPLE.TEST"])).toMatchObject({
      totalUsers: 6,
      respondents: 2,
      skipped: 1,
      uncollected: 3,
      excludedUsers: 1,
    });
    const [sql, params] = query.mock.calls[0]!;
    expect(params).toEqual([
      cohort.registeredFrom,
      cohort.registeredBefore,
      ["admin@example.test"],
    ]);
    expect(sql).toContain("LEFT JOIN user_onboarding");
    expect(sql).toContain("u.created_at >= $1");
    expect(sql).toContain("u.created_at < $2");
    expect(sql).toContain("GROUP BY 1, 2, 3");
    expect(sql).not.toContain("SELECT u.id");
  });
});
