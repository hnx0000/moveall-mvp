import { describe, expect, it } from "vitest";
import {
  CommentCreateInputSchema,
  KnowledgeFeedbackCreateInputSchema,
  MediaUploadRequestInputSchema,
  NicknameSchema,
  OnboardingInputSchema,
  PostCreateInputSchema,
  PostShareInputSchema,
  RegisterInputSchema,
  RoutineCreateInputSchema,
  RoutineReorderInputSchema,
  WorkoutSessionCreateInputSchema,
} from "../src/index.js";

describe("shared API contracts", () => {
  it("validates bounded GPS coordinates without requiring routes on historical/manual workouts", () => {
    const workout = {
      sport: "running",
      startedAt: "2026-09-03T00:00:00Z",
      endedAt: "2026-09-03T01:00:00Z",
      perceivedExertion: 5,
    };
    expect(WorkoutSessionCreateInputSchema.safeParse(workout).success).toBe(true);
    const point = {
      latitude: 37.5,
      longitude: 127,
      timestamp: 1000,
      accuracy: 5,
      altitude: null,
      breakBefore: true,
    };
    expect(
      WorkoutSessionCreateInputSchema.parse({ ...workout, routePoints: [point] }).routePoints,
    ).toEqual([point]);
    for (const invalid of [
      { ...point, latitude: 100 },
      { ...point, longitude: -181 },
      { ...point, timestamp: -1 },
      { ...point, accuracy: -5 },
    ]) {
      expect(
        WorkoutSessionCreateInputSchema.safeParse({ ...workout, routePoints: [invalid] }).success,
      ).toBe(false);
    }
    expect(
      WorkoutSessionCreateInputSchema.safeParse({
        ...workout,
        routePoints: Array.from({ length: 30001 }, () => point),
      }).success,
    ).toBe(false);
  });
  it("accepts comments and replies, rejects empty content and invalid parent IDs", () => {
    expect(CommentCreateInputSchema.parse({ content: "  멋져요!  " })).toEqual({
      content: "멋져요!",
    });
    expect(
      CommentCreateInputSchema.safeParse({
        content: "답글",
        parentCommentId: "bb7a5c2d-b8f8-4aa2-b287-a1b027e545de",
      }).success,
    ).toBe(true);
    expect(
      CommentCreateInputSchema.safeParse({ content: "답글", parentCommentId: "invalid" }).success,
    ).toBe(false);
    expect(CommentCreateInputSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(CommentCreateInputSchema.safeParse({ content: "a".repeat(501) }).success).toBe(false);
  });

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

  it("keeps onboarding short and bounds selections", () => {
    expect(
      OnboardingInputSchema.safeParse({
        primarySports: ["running", "strength"],
        activityLevel: "steady",
        goals: ["consistency", "performance"],
      }).success,
    ).toBe(true);
    expect(
      OnboardingInputSchema.safeParse({
        primarySports: ["running", "strength", "cycling", "swimming"],
        activityLevel: "steady",
        goals: ["consistency"],
      }).success,
    ).toBe(false);
  });

  it("accepts weight management while keeping the two-goal onboarding limit", () => {
    const input = {
      primarySports: ["running"],
      activityLevel: "starter",
      goals: ["consistency", "weight_management"],
    };
    expect(OnboardingInputSchema.safeParse(input).success).toBe(true);
    expect(
      OnboardingInputSchema.safeParse({
        ...input,
        goals: [...input.goals, "fitness"],
      }).success,
    ).toBe(false);
  });

  it("enforces media kind, MIME type, and size limits", () => {
    expect(
      MediaUploadRequestInputSchema.safeParse({
        kind: "avatar",
        contentType: "image/jpeg",
        byteSize: 5 * 1024 * 1024,
      }).success,
    ).toBe(true);
    expect(
      MediaUploadRequestInputSchema.safeParse({
        kind: "avatar",
        contentType: "video/mp4",
        byteSize: 1024,
      }).success,
    ).toBe(false);
    expect(
      MediaUploadRequestInputSchema.safeParse({
        kind: "post-image",
        contentType: "image/png",
        byteSize: 16 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });

  it("rejects explicitly abusive community text", () => {
    expect(
      PostCreateInputSchema.safeParse({ sport: "running", content: "오늘도 안전 러닝" }).success,
    ).toBe(true);
    expect(PostCreateInputSchema.safeParse({ sport: "running", content: "씨발" }).success).toBe(
      false,
    );
  });

  it("requires one to fifty unique recipients for a Tap Talk share", () => {
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    expect(
      PostShareInputSchema.parse({ recipientIds: [first, first, second] }).recipientIds,
    ).toEqual([first, second]);
    expect(PostShareInputSchema.safeParse({ recipientIds: [] }).success).toBe(false);
    expect(PostShareInputSchema.safeParse({ recipientIds: ["not-a-user"] }).success).toBe(false);
  });
});
