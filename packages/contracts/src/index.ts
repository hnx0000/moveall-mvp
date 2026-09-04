import { z } from "zod";
import { UsagePurposeSchema, type UsagePurposeResponse } from "./usage-purpose.js";
export * from "./usage-purpose.js";

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

export const activityLevelValues = ["starter", "steady", "advanced"] as const;
export const ActivityLevelSchema = z.enum(activityLevelValues);
export type ActivityLevel = z.infer<typeof ActivityLevelSchema>;

export const onboardingGoalValues = [
  "consistency",
  "fitness",
  "strength",
  "performance",
  "community",
  "weight_management",
] as const;
export const OnboardingGoalSchema = z.enum(onboardingGoalValues);
export type OnboardingGoal = z.infer<typeof OnboardingGoalSchema>;

export const NeighborhoodVerificationSchema = z.object({
  neighborhood: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  verifiedAt: z.iso.datetime({ offset: true }),
});
export type NeighborhoodVerification = z.infer<typeof NeighborhoodVerificationSchema>;

export const OnboardingInputSchema = z
  .object({
    primarySports: z.array(SportTypeSchema).min(1).max(3),
    activityLevel: ActivityLevelSchema,
    goals: z.array(OnboardingGoalSchema).min(1).max(2),
    usagePurpose: UsagePurposeSchema.nullable().optional(),
    neighborhood: NeighborhoodVerificationSchema.optional(),
  })
  .strict();
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export type OnboardingProfile = OnboardingInput &
  UsagePurposeResponse & {
    completedAt: string;
  };

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

export const AppleLoginInputSchema = z.object({
  identityToken: z.string().min(100).max(10_000),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase())
    .optional(),
  displayName: z.string().trim().min(2).max(30).optional(),
});
export type AppleLoginInput = z.infer<typeof AppleLoginInputSchema>;

export const AuthorizationCodeLoginInputSchema = z.object({
  code: z.string().min(1).max(4_096),
  redirectUri: z.url().max(2_048),
  state: z.string().min(8).max(512).optional(),
});
export type AuthorizationCodeLoginInput = z.infer<typeof AuthorizationCodeLoginInputSchema>;

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
  refreshToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime({ offset: true }),
  user: z.object({
    id: z.string(),
    email: z.email(),
    displayName: z.string(),
  }),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const RefreshSessionInputSchema = z.object({
  refreshToken: z.string().min(32).max(512),
});
export type RefreshSessionInput = z.infer<typeof RefreshSessionInputSchema>;

export const PasswordChangeInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(12, "비밀번호는 12자 이상이어야 합니다.")
    .max(128)
    .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다."),
});
export type PasswordChangeInput = z.infer<typeof PasswordChangeInputSchema>;

export const AccountDeletionInputSchema = z.object({
  confirmation: z.literal("GROOV 탈퇴"),
  currentPassword: z.string().min(1).max(128).optional(),
});
export type AccountDeletionInput = z.infer<typeof AccountDeletionInputSchema>;

export const ConsentUpdateInputSchema = z
  .object({
    termsVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    privacyVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
    healthDataAccepted: z.boolean(),
    locationAccepted: z.boolean(),
    mediaAccepted: z.boolean(),
    marketingAccepted: z.boolean().default(false),
  })
  .strict();
export type ConsentUpdateInput = z.infer<typeof ConsentUpdateInputSchema>;

export type ConsentState = ConsentUpdateInput & {
  acceptedAt: string;
};

export const MediaKindSchema = z.enum(["avatar", "post-image", "story-image", "story-video"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

const imageContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const MediaUploadRequestInputSchema = z
  .object({
    kind: MediaKindSchema,
    contentType: z.enum([...imageContentTypes, "video/mp4"]),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
  })
  .superRefine((value, context) => {
    const isImage = imageContentTypes.includes(
      value.contentType as (typeof imageContentTypes)[number],
    );
    if (value.kind === "story-video" && value.contentType !== "video/mp4") {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: "스토리 영상은 MP4 형식만 사용할 수 있습니다.",
      });
    }
    if (value.kind !== "story-video" && !isImage) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: "이 항목에는 JPEG, PNG 또는 WebP 이미지만 사용할 수 있습니다.",
      });
    }
    const maxBytes = value.kind === "avatar" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
    if (value.kind !== "story-video" && value.byteSize > maxBytes) {
      context.addIssue({
        code: "custom",
        path: ["byteSize"],
        message:
          value.kind === "avatar"
            ? "프로필 사진은 5MB 이하여야 합니다."
            : "사진은 15MB 이하여야 합니다.",
      });
    }
  });
export type MediaUploadRequestInput = z.infer<typeof MediaUploadRequestInputSchema>;

export type MediaUploadTicket = {
  mediaId: string;
  objectPath: string;
  signedUploadUrl: string;
  expiresAt: string;
};

export type AccountSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

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

export const WorkoutRoutePointSchema = z.object({
  latitude: z.number().finite().min(-85).max(85),
  longitude: z.number().finite().min(-180).max(180),
  timestamp: z.number().finite().nonnegative(),
  accuracy: z.number().finite().nonnegative().nullable().optional(),
  altitude: z.number().finite().nullable().optional(),
  breakBefore: z.boolean().optional(),
});
export type WorkoutRoutePoint = z.infer<typeof WorkoutRoutePointSchema>;

export const WorkoutSessionCreateInputSchema = z
  .object({
    sport: SportTypeSchema,
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }),
    perceivedExertion: z.number().int().min(1).max(10),
    notes: z.string().trim().max(1000).optional(),
    metrics: z.record(z.string().max(50), z.number().finite()).default({}),
    routePoints: z.array(WorkoutRoutePointSchema).max(30000).optional(),
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

const blockedCommunityFragments = [
  "시발",
  "씨발",
  "병신",
  "fuck",
  "nigger",
  "강간",
  "몰카",
] as const;

function communityText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => {
      const normalized = value.toLowerCase().replace(/\s+/g, "");
      return !blockedCommunityFragments.some((term) => normalized.includes(term));
    }, "괴롭힘, 혐오, 성적 착취 또는 노골적인 비속어가 포함된 내용은 등록할 수 없습니다.");
}

export const PostAudienceSchema = z.object({
  scope: z.enum(["public", "followers", "mutuals", "crews", "users", "private", "none"]),
  userIds: z.array(z.uuid()).max(100).optional(),
  crewIds: z.array(z.uuid()).max(20).optional(),
});
export type PostAudience = z.infer<typeof PostAudienceSchema>;
export const SharingCrewCreateInputSchema = z.object({
  name: communityText(1, 30),
  memberIds: z.array(z.uuid()).min(1).max(100),
});
export type SharingCrewCreateInput = z.infer<typeof SharingCrewCreateInputSchema>;
export type SharingCrew = SharingCrewCreateInput & { id: string; userId: string };

export const PostCreateInputSchema = z
  .object({
    sport: SportTypeSchema,
    content: communityText(1, 2000),
    workoutSessionId: z.uuid().optional(),
    mediaId: z.uuid().optional(),
    contentType: z.enum(["post", "story"]).optional(),
    audience: PostAudienceSchema.optional(),
    commentAudience: PostAudienceSchema.optional(),
  })
  .superRefine((value, context) => {
    for (const key of ["audience", "commentAudience"] as const) {
      const audience = value[key];
      if (key === "audience" && audience?.scope === "none")
        context.addIssue({
          code: "custom",
          path: [key],
          message: "게시물 공개 범위를 선택해 주세요.",
        });
      if (
        (audience?.scope === "users" && !audience.userIds?.length) ||
        (audience?.scope === "crews" && !audience.crewIds?.length)
      )
        context.addIssue({
          code: "custom",
          path: [key],
          message: "공개할 대상을 한 명 이상 선택해 주세요.",
        });
    }
  });
export type PostCreateInput = z.infer<typeof PostCreateInputSchema>;

export const PostUpdateInputSchema = z.object({
  content: communityText(1, 2000),
});
export type PostUpdateInput = z.infer<typeof PostUpdateInputSchema>;

export const DirectMessageCreateInputSchema = z.object({
  content: communityText(1, 1000),
});
export type DirectMessageCreateInput = z.infer<typeof DirectMessageCreateInputSchema>;

export const PostShareInputSchema = z.object({
  recipientIds: z
    .array(z.uuid())
    .min(1)
    .max(50)
    .transform((ids) => [...new Set(ids)]),
});
export type PostShareInput = z.infer<typeof PostShareInputSchema>;

export const CommentCreateInputSchema = z.object({
  content: communityText(1, 500),
  parentCommentId: z.uuid().optional(),
  mentions: z
    .array(
      z.object({
        userId: z.string().min(1).max(120),
        displayName: z.string().min(1).max(100),
        start: z.number().int().min(0),
        end: z.number().int().min(1).max(500),
      }),
    )
    .max(20)
    .optional(),
});
export type CommentCreateInput = z.infer<typeof CommentCreateInputSchema>;
export type CommentMention = NonNullable<CommentCreateInput["mentions"]>[number];
export type SocialSuggestions = { people: PublicUser[]; frequentIds: string[] };
export type PostLikeState = { liked: boolean; likeCount: number; changed: boolean };
export { rankSocialPeople, type ShareFrequency } from "./social-suggestions.js";

export const KnowledgeFeedbackCreateInputSchema = z.object({
  content: communityText(2, 500),
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

export type SocialPrivacy = {
  hideFollowers: boolean;
  hideFollowing: boolean;
};

export type SafetySummary = SocialPrivacy & {
  blocked: PublicUser[];
  restricted: PublicUser[];
};

export type MemberConnections = SocialSummary & {
  followersHidden: boolean;
  followingHidden: boolean;
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

export type PublicMemberProfile = {
  user: PublicUser;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  posts: FeedPost[];
  workouts: WorkoutSession[];
  medals: Medal[];
};

export type FeedComment = {
  mentions?: CommentMention[];
  id: string;
  userId: string;
  authorDisplayName: string;
  authorAvatarDataUri?: string;
  content: string;
  createdAt: string;
  parentCommentId?: string;
  likeCount: number;
  likedByMe: boolean;
};

export type FeedPost = PostCreateInput & {
  likedByMe?: boolean;
  id: string;
  userId: string;
  authorDisplayName: string;
  authorAvatarDataUri?: string;
  contentType: "post" | "story";
  likeCount: number;
  shareCount?: number;
  createdAt: string;
  archivedAt?: string;
  mediaObjectPath?: string;
  mediaUrl?: string;
  comments: FeedComment[];
  canComment?: boolean;
  expiresAt?: string;
  workoutSummary?: {
    startedAt: string;
    endedAt: string;
    metrics: Record<string, number>;
  };
};

export {
  audienceAllows,
  storyIsActive,
  presentPostAccess,
  resolveCrewAudience,
} from "./post-permissions.js";

export type PostShareResult = {
  shareCount: number;
  recipientCount: number;
  recipientIds: string[];
};

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  sharedPost?: Pick<FeedPost, "id" | "authorDisplayName" | "sport" | "content"> | null;
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

export const ContentReportCreateInputSchema = z.object({
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.string().trim().min(1).max(120),
  reason: z.enum([
    "spam",
    "harassment",
    "hate",
    "dangerous",
    "fraud",
    "privacy",
    "copyright",
    "other",
  ]),
  details: z.string().trim().max(1000).optional(),
});
export type ContentReportCreateInput = z.infer<typeof ContentReportCreateInputSchema>;

export const ModerationReportUpdateInputSchema = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolutionNote: z.string().trim().max(1000).optional(),
});
export type ModerationReportUpdateInput = z.infer<typeof ModerationReportUpdateInputSchema>;

export type ContentReport = ContentReportCreateInput & {
  id: string;
  reporterId: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type UserNotification = {
  id: string;
  kind:
    | "follow"
    | "comment"
    | "share"
    | "moderation"
    | "system"
    | "like"
    | "message"
    | "mention"
    | "goal_activity";
  title: string;
  body: string;
  actorId?: string;
  resourceType?: "post" | "comment" | "user" | "report";
  resourceId?: string;
  readAt?: string;
  createdAt: string;
};

export const PushDeviceRegistrationInputSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20)
    .max(300)
    .refine(
      (value) => /^(Expo(nent)?PushToken\[[A-Za-z0-9_-]+\])$/.test(value),
      "올바른 Expo 푸시 토큰이 아닙니다.",
    ),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().trim().min(1).max(120).optional(),
});
export type PushDeviceRegistrationInput = z.infer<typeof PushDeviceRegistrationInputSchema>;
