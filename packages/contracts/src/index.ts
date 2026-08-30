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

export const GoogleLoginInputSchema = z.object({
  idToken: z.string().min(100).max(10_000),
});
export type GoogleLoginInput = z.infer<typeof GoogleLoginInputSchema>;

const blockedNicknameFragments = [
  "admin",
  "administrator",
  "moveallofficial",
  "moveall_official",
  "officialmoveall",
  "groovofficial",
  "groov_official",
  "officialgroov",
  "관리자",
  "운영자",
  "공식계정",
  "시발",
  "씨발",
  "병신",
  "fuck",
  "shit",
] as const;

export const NicknameSchema = z
  .string()
  .trim()
  .min(2, "닉네임은 2자 이상이어야 합니다.")
  .max(20, "닉네임은 20자 이하여야 합니다.")
  .regex(/^[가-힣A-Za-z0-9._]+$/u, "한글, 영문, 숫자, 마침표와 밑줄만 사용할 수 있습니다.")
  .refine((value) => !/^[._]|[._]$/.test(value), {
    message: "마침표와 밑줄은 닉네임의 처음이나 끝에 사용할 수 없습니다.",
  })
  .refine((value) => !/[._]{2}/.test(value), {
    message: "마침표와 밑줄을 연속으로 사용할 수 없습니다.",
  })
  .refine((value) => {
    const normalized = value.toLowerCase().replace(/[._]/g, "");
    return !blockedNicknameFragments.some((term) => normalized.includes(term.replace(/[._]/g, "")));
  }, "비속어, 사칭 또는 운영 계정으로 오인될 수 있는 닉네임은 사용할 수 없습니다.");

export const ProfileUpdateInputSchema = z
  .object({
    displayName: NicknameSchema.optional(),
    avatarDataUri: z
      .string()
      .max(800_000, "프로필 사진은 800KB 이하여야 합니다.")
      .regex(
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
        "JPEG, PNG 또는 WebP 사진만 사용할 수 있습니다.",
      )
      .nullable()
      .optional(),
  })
  .refine((value) => value.displayName !== undefined || value.avatarDataUri !== undefined, {
    message: "변경할 프로필 정보를 입력해 주세요.",
  });
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;

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

export const RoutineUpdateInputSchema = RoutineCreateInputSchema;
export type RoutineUpdateInput = z.infer<typeof RoutineUpdateInputSchema>;

export const RoutineReorderInputSchema = z.object({
  routineIds: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "루틴 순서에는 중복된 항목이 없어야 합니다.",
    }),
});
export type RoutineReorderInput = z.infer<typeof RoutineReorderInputSchema>;

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

export const WorkoutSessionUpdateInputSchema = z
  .object({
    notes: z.string().trim().max(1000).nullable().optional(),
    perceivedExertion: z.number().int().min(1).max(10).optional(),
    metrics: z.record(z.string().max(50), z.number().finite()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "수정할 운동 기록 내용을 입력해 주세요.",
  });
export type WorkoutSessionUpdateInput = z.infer<typeof WorkoutSessionUpdateInputSchema>;

export const PostCreateInputSchema = z.object({
  sport: SportTypeSchema,
  content: z.string().trim().min(1).max(2000),
  workoutSessionId: z.uuid().optional(),
  contentType: z.enum(["post", "story"]).optional(),
});
export type PostCreateInput = z.infer<typeof PostCreateInputSchema>;

export const PostUpdateInputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
export type PostUpdateInput = z.infer<typeof PostUpdateInputSchema>;

export const DirectMessageCreateInputSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});
export type DirectMessageCreateInput = z.infer<typeof DirectMessageCreateInputSchema>;

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
  sortOrder: number;
  createdAt: string;
};

export type WorkoutSession = WorkoutSessionCreateInput & {
  id: string;
  userId: string;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  displayName: string;
  avatarDataUri?: string;
};

export type UserProfile = PublicUser & {
  email: string;
};

export type SocialSummary = {
  followersCount: number;
  followingCount: number;
  followers: PublicUser[];
  following: PublicUser[];
};

export type FollowStatus = {
  following: boolean;
  followersCount: number;
};

export type MedalTier = "newbie" | "intermediate" | "advanced" | "athlete" | "instructor";

export type Medal = {
  id: string;
  sport: SportType;
  title: string;
  description: string;
  tier: MedalTier;
  earned: boolean;
  progress: number;
  target: number;
  physicalRewardEligible: boolean;
  earnedAt?: string;
};

export type FeedPost = PostCreateInput & {
  id: string;
  userId: string;
  authorDisplayName: string;
  contentType: "post" | "story";
  likeCount: number;
  createdAt: string;
  archivedAt?: string;
  comments: Array<{
    id: string;
    userId: string;
    authorDisplayName: string;
    content: string;
    createdAt: string;
  }>;
};

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
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
