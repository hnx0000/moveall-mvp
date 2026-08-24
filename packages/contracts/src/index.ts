import { z } from "zod";

export const sportValues = [
  "strength",
  "running",
  "hiking",
  "diving",
  "cycling",
  "swimming",
] as const;

export const SportTypeSchema = z.enum(sportValues);
export type SportType = z.infer<typeof SportTypeSchema>;

export const sportLabels: Record<SportType, string> = {
  strength: "근력 운동",
  running: "러닝",
  hiking: "등산",
  diving: "다이빙",
  cycling: "사이클",
  swimming: "수영",
};

export const RegisterInputSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "비밀번호는 12자 이상이어야 합니다.")
    .max(128)
    .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다."),
  displayName: z.string().trim().min(2).max(30),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.email(),
    displayName: z.string(),
  }),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const RoutineItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target: z.string().trim().min(1).max(160),
  order: z.number().int().min(0).max(100),
});

export const RoutineCreateInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  sport: SportTypeSchema,
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, {
      message: "운동 요일은 중복될 수 없습니다.",
    }),
  items: z.array(RoutineItemSchema).min(1).max(30),
});
export type RoutineCreateInput = z.infer<typeof RoutineCreateInputSchema>;

export const WorkoutSessionCreateInputSchema = z
  .object({
    sport: SportTypeSchema,
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }),
    perceivedExertion: z.number().int().min(1).max(10),
    notes: z.string().trim().max(1000).optional(),
    metrics: z.record(z.string().max(50), z.number().finite()).default({}),
    source: z.enum(["manual", "wearable"]).default("manual"),
  })
  .refine((value) => Date.parse(value.endedAt) > Date.parse(value.startedAt), {
    message: "운동 종료 시각은 시작 시각보다 늦어야 합니다.",
    path: ["endedAt"],
  });
export type WorkoutSessionCreateInput = z.infer<typeof WorkoutSessionCreateInputSchema>;

export const PostCreateInputSchema = z.object({
  sport: SportTypeSchema,
  content: z.string().trim().min(1).max(2000),
  workoutSessionId: z.uuid().optional(),
});
export type PostCreateInput = z.infer<typeof PostCreateInputSchema>;

export const CommentCreateInputSchema = z.object({
  content: z.string().trim().min(1).max(500),
});
export type CommentCreateInput = z.infer<typeof CommentCreateInputSchema>;

export const KnowledgeFeedbackCreateInputSchema = z.object({
  content: z.string().trim().min(2).max(500),
  context: z.string().trim().max(120).optional(),
});
export type KnowledgeFeedbackCreateInput = z.infer<typeof KnowledgeFeedbackCreateInputSchema>;

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
};

export type SportSummary = {
  id: SportType;
  label: string;
  safetyLevel: "standard" | "heightened";
  knowledgeReviewStatus: "DRAFT" | "EXPERT_REVIEWED";
};

export type Routine = RoutineCreateInput & {
  id: string;
  userId: string;
  createdAt: string;
};

export type WorkoutSession = WorkoutSessionCreateInput & {
  id: string;
  userId: string;
  createdAt: string;
};

export type FeedPost = PostCreateInput & {
  id: string;
  userId: string;
  authorDisplayName: string;
  createdAt: string;
  comments: Array<{
    id: string;
    userId: string;
    authorDisplayName: string;
    content: string;
    createdAt: string;
  }>;
};

export type KnowledgeArticle = {
  id: string;
  sport: SportType;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  situationalNote: string;
  reviewStatus: "DRAFT" | "EXPERT_REVIEWED";
  reviewedBy?: string;
  reviewedAt?: string;
  sources: Array<{
    title: string;
    organization: string;
    url: string;
  }>;
  safetyNotice: string;
  feedback: KnowledgeFeedback[];
};

export type KnowledgeFeedback = {
  id: string;
  articleId: string;
  userId: string;
  authorDisplayName: string;
  content: string;
  context?: string;
  createdAt: string;
};
