import type {
  AccountDeletionInput,
  AccountSession,
  AppleLoginInput,
  AuthorizationCodeLoginInput,
  ApiFailure,
  ApiSuccess,
  AuthSession,
  CommentCreateInput,
  ContentReport,
  ContentReportCreateInput,
  ConsentState,
  ConsentUpdateInput,
  DirectMessage,
  DirectMessageCreateInput,
  FeedPost,
  FollowStatus,
  GoogleLoginInput,
  KnowledgeArticle,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  LoginInput,
  Medal,
  MediaUploadRequestInput,
  MediaUploadTicket,
  ModerationReportUpdateInput,
  OnboardingInput,
  OnboardingProfile,
  PasswordChangeInput,
  PostCreateInput,
  PostShareResult,
  PostUpdateInput,
  ProfileUpdateInput,
  PublicMemberProfile,
  PublicUser,
  PushDeviceRegistrationInput,
  RegisterInput,
  RefreshSessionInput,
  Routine,
  RoutineCreateInput,
  RoutineReorderInput,
  RoutineUpdateInput,
  SocialSummary,
  SportSummary,
  SportType,
  UserProfile,
  UserNotification,
  WorkoutSession,
  WorkoutSessionCreateInput,
  WorkoutSessionUpdateInput,
} from "@moveall/contracts";
import { demoApi } from "./demo-client";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", "Bearer " + options.token);

  try {
    const response = await fetch(apiBaseUrl + path, { ...options, headers });
    const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
    if (!response.ok || !payload.ok) {
      const failure = payload as ApiFailure;
      throw new ApiError(failure.error.message, failure.error.code);
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "서버에 연결할 수 없습니다. API 주소와 실행 상태를 확인해 주세요.",
      "NETWORK_ERROR",
    );
  }
}

const liveApi = {
  register: (input: RegisterInput) =>
    request<AuthSession>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: LoginInput) =>
    request<AuthSession>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  googleLogin: (input: GoogleLoginInput) =>
    request<AuthSession>("/v1/auth/google", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  appleLogin: (input: AppleLoginInput) =>
    request<AuthSession>("/v1/auth/apple", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  kakaoLogin: (input: AuthorizationCodeLoginInput) =>
    request<AuthSession>("/v1/auth/kakao", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  naverLogin: (input: AuthorizationCodeLoginInput) =>
    request<AuthSession>("/v1/auth/naver", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  devLogin: () =>
    request<AuthSession>("/v1/auth/development", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  refreshSession: (input: RefreshSessionInput) =>
    request<AuthSession>("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: (token: string) =>
    request<{ loggedOut: true }>("/v1/auth/logout", { token, method: "POST" }),
  me: (token: string) => request<AuthSession["user"]>("/v1/auth/me", { token }),
  authProviders: () =>
    request<{
      google: boolean;
      apple: boolean;
      kakao: boolean;
      naver: boolean;
      development: boolean;
    }>("/v1/auth/providers"),
  profile: (token: string) => request<UserProfile>("/v1/users/me/profile", { token }),
  updateProfile: (token: string, input: ProfileUpdateInput) =>
    request<UserProfile>("/v1/users/me/profile", {
      token,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  onboarding: (token: string) =>
    request<OnboardingProfile | null>("/v1/users/me/onboarding", { token }),
  saveOnboarding: (token: string, input: OnboardingInput) =>
    request<OnboardingProfile>("/v1/users/me/onboarding", {
      token,
      method: "PUT",
      body: JSON.stringify(input),
    }),
  accountSessions: (token: string) => request<AccountSession[]>("/v1/account/sessions", { token }),
  revokeAccountSession: (token: string, sessionId: string) =>
    request<{ revoked: true }>(`/v1/account/sessions/${sessionId}`, {
      token,
      method: "DELETE",
    }),
  changePassword: (token: string, input: PasswordChangeInput) =>
    request<AuthSession>("/v1/account/password", {
      token,
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteAccount: (token: string, input: AccountDeletionInput) =>
    request<{ deleted: true }>("/v1/account", {
      token,
      method: "DELETE",
      body: JSON.stringify(input),
    }),
  consent: (token: string) => request<ConsentState | null>("/v1/consents/me", { token }),
  updateConsent: (token: string, input: ConsentUpdateInput) =>
    request<ConsentState>("/v1/consents/me", {
      token,
      method: "PUT",
      body: JSON.stringify(input),
    }),
  createMediaUploadTicket: (token: string, input: MediaUploadRequestInput) =>
    request<MediaUploadTicket>("/v1/media/upload-ticket", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  completeMediaUpload: (token: string, mediaId: string) =>
    request<{ id: string; status: "available"; objectPath: string }>(
      `/v1/media/${mediaId}/complete`,
      { token, method: "POST" },
    ),
  sports: () => request<SportSummary[]>("/v1/sports"),
  knowledge: (sport: SportType) => request<KnowledgeArticle[]>("/v1/knowledge/" + sport),
  createKnowledgeFeedback: (
    token: string,
    articleId: string,
    input: KnowledgeFeedbackCreateInput,
  ) =>
    request<KnowledgeFeedback>(`/v1/knowledge/${articleId}/feedback`, {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  feed: (token?: string) => request<FeedPost[]>("/v1/feed", token ? { token } : undefined),
  post: (postId: string, token?: string) =>
    request<FeedPost>(`/v1/posts/${postId}`, token ? { token } : undefined),
  routines: (token: string) => request<Routine[]>("/v1/routines/me", { token }),
  createRoutine: (token: string, input: RoutineCreateInput) =>
    request<Routine>("/v1/routines", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRoutine: (token: string, routineId: string, input: RoutineUpdateInput) =>
    request<Routine>(`/v1/routines/${routineId}`, {
      token,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteRoutine: (token: string, routineId: string) =>
    request<{ deleted: true }>(`/v1/routines/${routineId}`, {
      token,
      method: "DELETE",
    }),
  reorderRoutines: (token: string, input: RoutineReorderInput) =>
    request<Routine[]>("/v1/routines/order", {
      token,
      method: "PUT",
      body: JSON.stringify(input),
    }),
  createPost: (token: string, input: PostCreateInput, _previewMediaUri?: string) =>
    request<FeedPost>("/v1/posts", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  sharingCrews: (token: string) =>
    request<import("@moveall/contracts").SharingCrew[]>("/v1/sharing-crews", { token }),
  createSharingCrew: (token: string, input: import("@moveall/contracts").SharingCrewCreateInput) =>
    request<import("@moveall/contracts").SharingCrew>("/v1/sharing-crews", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  createComment: (token: string, postId: string, input: CommentCreateInput) =>
    request<FeedPost["comments"][number]>(`/v1/posts/${postId}/comments`, {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  socialSuggestions: (token: string) =>
    request<import("@moveall/contracts").SocialSuggestions>("/v1/social/suggestions", { token }),
  setPostLiked: (token: string, postId: string, liked: boolean) =>
    request<import("@moveall/contracts").PostLikeState>(`/v1/posts/${postId}/like`, {
      token,
      method: liked ? "PUT" : "DELETE",
    }),
  setCommentLiked: (token: string, postId: string, commentId: string, liked: boolean) =>
    request<FeedPost["comments"][number]>(`/v1/posts/${postId}/comments/${commentId}/like`, {
      token,
      method: liked ? "PUT" : "DELETE",
    }),
  sharePost: (token: string, postId: string, recipientIds: string[]) =>
    request<PostShareResult>(`/v1/posts/${postId}/share`, {
      token,
      method: "POST",
      body: JSON.stringify({ recipientIds }),
    }),
  workouts: (token: string) => request<WorkoutSession[]>("/v1/workout-sessions/me", { token }),
  createWorkoutSession: (token: string, input: WorkoutSessionCreateInput) =>
    request<WorkoutSession>("/v1/workout-sessions", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateWorkoutSession: (token: string, workoutId: string, input: WorkoutSessionUpdateInput) =>
    request<WorkoutSession>(`/v1/workout-sessions/${workoutId}`, {
      token,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteWorkoutSession: (token: string, workoutId: string) =>
    request<{ deleted: true }>(`/v1/workout-sessions/${workoutId}`, {
      token,
      method: "DELETE",
    }),
  myPosts: (token: string) => request<FeedPost[]>("/v1/posts/me", { token }),
  archivedPosts: (token: string) => request<FeedPost[]>("/v1/posts/me/archive", { token }),
  updatePost: (token: string, postId: string, input: PostUpdateInput) =>
    request<FeedPost>(`/v1/posts/${postId}`, {
      token,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archivePost: (token: string, postId: string) =>
    request<FeedPost>(`/v1/posts/${postId}/archive`, { token, method: "POST" }),
  restorePost: (token: string, postId: string) =>
    request<FeedPost>(`/v1/posts/${postId}/archive`, { token, method: "DELETE" }),
  deletePost: (token: string, postId: string) =>
    request<{ deleted: true }>(`/v1/posts/${postId}`, { token, method: "DELETE" }),
  userPosts: (token: string, userId: string) =>
    request<{ user: PublicUser; posts: FeedPost[] }>(`/v1/users/${userId}/posts`, { token }),
  memberProfile: (token: string, userId: string) =>
    request<PublicMemberProfile>(`/v1/users/${userId}/profile`, { token }),
  socialSummary: (token: string) => request<SocialSummary>("/v1/social/me", { token }),
  memberConnections: (token: string, userId: string) =>
    request<import("@moveall/contracts").MemberConnections>(`/v1/users/${userId}/connections`, {
      token,
    }),
  safetySummary: (token: string) =>
    request<import("@moveall/contracts").SafetySummary>("/v1/social/safety", { token }),
  saveSocialPrivacy: (token: string, privacy: import("@moveall/contracts").SocialPrivacy) =>
    request<import("@moveall/contracts").SocialPrivacy>("/v1/social/privacy", {
      token,
      method: "PUT",
      body: JSON.stringify(privacy),
    }),
  unblockUser: (token: string, userId: string) =>
    request<{ blocked: false }>(`/v1/users/${userId}/block`, { token, method: "DELETE" }),
  restrictUser: (token: string, userId: string, restricted: boolean) =>
    request<{ restricted: boolean }>(`/v1/users/${userId}/restriction`, {
      token,
      method: restricted ? "PUT" : "DELETE",
    }),
  medals: (token: string) => request<Medal[]>("/v1/medals/me", { token }),
  followStatus: (token: string, userId: string) =>
    request<FollowStatus>(`/v1/users/${userId}/follow-status`, { token }),
  follow: (token: string, userId: string) =>
    request<{ following: true }>(`/v1/users/${userId}/follow`, {
      token,
      method: "POST",
    }),
  unfollow: (token: string, userId: string) =>
    request<{ following: false }>(`/v1/users/${userId}/follow`, {
      token,
      method: "DELETE",
    }),
  removeFollower: (token: string, userId: string) =>
    request<{ removed: true }>(`/v1/users/${userId}/follower`, {
      token,
      method: "DELETE",
    }),
  blockUser: (token: string, userId: string) =>
    request<{ blocked: true }>(`/v1/users/${userId}/block`, {
      token,
      method: "POST",
    }),
  createReport: (token: string, input: ContentReportCreateInput) =>
    request<ContentReport>("/v1/reports", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
  notifications: (token: string) => request<UserNotification[]>("/v1/notifications", { token }),
  markNotificationRead: (token: string, notificationId: string) =>
    request<UserNotification>(`/v1/notifications/${notificationId}/read`, {
      token,
      method: "PATCH",
    }),
  registerPushDevice: (token: string, input: PushDeviceRegistrationInput) =>
    request<{ id: string; platform: "ios" | "android"; registeredAt: string }>(
      "/v1/notifications/push-device",
      { token, method: "PUT", body: JSON.stringify(input) },
    ),
  unregisterPushDevice: (token: string, pushToken: string) =>
    request<{ unregistered: true }>("/v1/notifications/push-device", {
      token,
      method: "DELETE",
      body: JSON.stringify({ token: pushToken }),
    }),
  moderationReports: (token: string) => request<ContentReport[]>("/v1/admin/reports", { token }),
  usagePurposeSummary: (
    token: string,
    cohort: import("@moveall/contracts").UsagePurposeCohort = {},
  ) => {
    const query = new URLSearchParams();
    if (cohort.registeredFrom) query.set("registeredFrom", cohort.registeredFrom);
    if (cohort.registeredBefore) query.set("registeredBefore", cohort.registeredBefore);
    return request<import("@moveall/contracts").UsagePurposeSummary>(
      `/v1/admin/usage-purposes${query.size ? `?${query}` : ""}`,
      { token },
    );
  },
  updateModerationReport: (token: string, reportId: string, input: ModerationReportUpdateInput) =>
    request<ContentReport>(`/v1/admin/reports/${reportId}`, {
      token,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  messages: (token: string, userId: string) =>
    request<DirectMessage[]>(`/v1/messages/${userId}`, { token }),
  sendMessage: (token: string, userId: string, input: DirectMessageCreateInput) =>
    request<DirectMessage>(`/v1/messages/${userId}`, {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const usePreviewApi = process.env.EXPO_PUBLIC_LOGIN_REQUIRED !== "true";

export const api = usePreviewApi ? demoApi : liveApi;
