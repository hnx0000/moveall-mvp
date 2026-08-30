import type {
  ApiFailure,
  ApiSuccess,
  AuthSession,
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
  PostCreateInput,
  PostUpdateInput,
  ProfileUpdateInput,
  PublicUser,
  RegisterInput,
  Routine,
  RoutineCreateInput,
  RoutineReorderInput,
  RoutineUpdateInput,
  SocialSummary,
  SportSummary,
  SportType,
  UserProfile,
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
  devLogin: () =>
    request<AuthSession>("/v1/auth/development", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  me: (token: string) => request<AuthSession["user"]>("/v1/auth/me", { token }),
  authProviders: () => request<{ google: boolean; development: boolean }>("/v1/auth/providers"),
  profile: (token: string) => request<UserProfile>("/v1/users/me/profile", { token }),
  updateProfile: (token: string, input: ProfileUpdateInput) =>
    request<UserProfile>("/v1/users/me/profile", {
      token,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
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
  feed: () => request<FeedPost[]>("/v1/feed"),
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
  createPost: (token: string, input: PostCreateInput) =>
    request<FeedPost>("/v1/posts", {
      token,
      method: "POST",
      body: JSON.stringify(input),
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
  socialSummary: (token: string) => request<SocialSummary>("/v1/social/me", { token }),
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
  messages: (token: string, userId: string) =>
    request<DirectMessage[]>(`/v1/messages/${userId}`, { token }),
  sendMessage: (token: string, userId: string, input: DirectMessageCreateInput) =>
    request<DirectMessage>(`/v1/messages/${userId}`, {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
};

const usePreviewApi = process.env.EXPO_PUBLIC_LOGIN_REQUIRED !== "true";

export const api = usePreviewApi ? demoApi : liveApi;
