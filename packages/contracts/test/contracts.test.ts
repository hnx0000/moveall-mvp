import { describe, expect, it } from "vitest";
import {
  KnowledgeFeedbackCreateInputSchema,
  NicknameSchema,
  RegisterInputSchema,
  RoutineCreateInputSchema,
  RoutineReorderInputSchema,
  WorkoutSessionCreateInputSchema,
} from "../src/index.js";

describe("shared API contracts", () => {
  it("accepts a valid routine", () => {
    const result = RoutineCreateInputSchema.safeParse({
      title: "주 3회 전신",
      sport: "strength",
      daysOfWeek: [1, 3, 5],
      items: [{ name: "스쿼트", target: "5회 x 5세트", order: 0 }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a workout with an invalid time range", () => {
    const result = WorkoutSessionCreateInputSchema.safeParse({
      sport: "running",
      startedAt: "2026-08-24T10:00:00+09:00",
      endedAt: "2026-08-24T09:00:00+09:00",
      perceivedExertion: 5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects weak passwords", () => {
    const result = RegisterInputSchema.safeParse({
      email: "runner@example.com",
      password: "password",
      displayName: "러너",
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate routine days", () => {
    const result = RoutineCreateInputSchema.safeParse({
      title: "중복 요일",
      sport: "running",
      daysOfWeek: [2, 2],
      items: [{ name: "이지 런", target: "20분", order: 0 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate routine ids in a reorder request", () => {
    const routineId = "f928f020-3a90-4f99-892d-422cac210478";
    expect(
      RoutineReorderInputSchema.safeParse({ routineIds: [routineId, routineId] }).success,
    ).toBe(false);
  });

  it("rejects an empty knowledge feedback", () => {
    expect(KnowledgeFeedbackCreateInputSchema.safeParse({ content: " " }).success).toBe(false);
  });

  it("accepts a localized handle and rejects reserved or abusive nicknames", () => {
    expect(NicknameSchema.safeParse("러너.minji_24").success).toBe(true);
    expect(NicknameSchema.safeParse("groov_official").success).toBe(false);
    expect(NicknameSchema.safeParse("욕설_씨발").success).toBe(false);
    expect(NicknameSchema.safeParse("공백 닉네임").success).toBe(false);
  });
});
