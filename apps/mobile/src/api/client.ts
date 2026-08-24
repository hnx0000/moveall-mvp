import type {
  ApiFailure,
  ApiSuccess,
  AuthSession,
  FeedPost,
  KnowledgeArticle,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  LoginInput,
  PostCreateInput,
  RegisterInput,
  Routine,
  RoutineCreateInput,
  SportSummary,
  SportType,
} from "@moveall/contracts";
import { demoApi } from "./demo-client";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
    const response = await fetch(baseUrl + path, { ...options, headers });
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
  createPost: (token: string, input: PostCreateInput) =>
    request<FeedPost>("/v1/posts", {
      token,
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const api = process.env.EXPO_PUBLIC_DEMO_MODE === "true" ? demoApi : liveApi;
