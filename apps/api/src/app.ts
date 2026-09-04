import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  rankSocialPeople,
  AccountDeletionInputSchema,
  AppleLoginInputSchema,
  AuthorizationCodeLoginInputSchema,
  CommentCreateInputSchema,
  ContentReportCreateInputSchema,
  ConsentUpdateInputSchema,
  DirectMessageCreateInputSchema,
  GoogleLoginInputSchema,
  KnowledgeFeedbackCreateInputSchema,
  LoginInputSchema,
  MediaUploadRequestInputSchema,
  ModerationReportUpdateInputSchema,
  OnboardingInputSchema,
  UsagePurposeCohortSchema,
  PasswordChangeInputSchema,
  PostCreateInputSchema,
  SharingCrewCreateInputSchema,
  PostShareInputSchema,
  PostUpdateInputSchema,
  PushDeviceRegistrationInputSchema,
  ProfileUpdateInputSchema,
  RegisterInputSchema,
  RefreshSessionInputSchema,
  RoutineCreateInputSchema,
  RoutineReorderInputSchema,
  RoutineUpdateInputSchema,
  SportTypeSchema,
  WorkoutSessionCreateInputSchema,
  WorkoutSessionUpdateInputSchema,
  type ApiSuccess,
  type FeedPost,
} from "@moveall/contracts";
import Fastify, { type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import type { AppConfig } from "./config.js";
import { AppError } from "./domain/errors.js";
import type { AppStore, User } from "./domain/store.js";
import { DisabledMediaStorage, type MediaStorage } from "./infrastructure/media-storage.js";
import { DisabledPushSender, type PushSender } from "./infrastructure/push-sender.js";
import { knowledgeArticles, sports } from "./knowledge.js";
import { medalsFor } from "./medals.js";
import { verifyAppleIdentityToken, type AppleTokenVerifier } from "./security/apple-identity.js";
import { verifyGoogleIdToken, type GoogleTokenVerifier } from "./security/google-identity.js";
import {
  exchangeKakaoAuthorizationCode,
  type KakaoCodeExchanger,
} from "./security/kakao-identity.js";
import {
  exchangeNaverAuthorizationCode,
  type NaverCodeExchanger,
} from "./security/naver-identity.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import { TokenService } from "./security/token.js";

type AppDependencies = {
  config: AppConfig;
  store: AppStore;
  logger?: boolean | Record<string, unknown>;
  googleTokenVerifier?: GoogleTokenVerifier;
  appleTokenVerifier?: AppleTokenVerifier;
  kakaoCodeExchanger?: KakaoCodeExchanger;
  naverCodeExchanger?: NaverCodeExchanger;
  mediaStorage?: MediaStorage;
  pushSender?: PushSender;
};

function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export async function createApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    bodyLimit: 1_000_000,
  });
  const tokenService = new TokenService(dependencies.config.authSecret);
  const googleTokenVerifier = dependencies.googleTokenVerifier ?? verifyGoogleIdToken;
  const appleTokenVerifier = dependencies.appleTokenVerifier ?? verifyAppleIdentityToken;
  const kakaoCodeExchanger = dependencies.kakaoCodeExchanger ?? exchangeKakaoAuthorizationCode;
  const naverCodeExchanger = dependencies.naverCodeExchanger ?? exchangeNaverAuthorizationCode;
  const mediaStorage = dependencies.mediaStorage ?? new DisabledMediaStorage();
  const pushSender = dependencies.pushSender ?? new DisabledPushSender();

  async function notifyUser(userId: string, input: Parameters<AppStore["createNotification"]>[1]) {
    const notification = await dependencies.store.createNotification(userId, input);
    const tokens = await dependencies.store.listPushDeviceTokens(userId);
    if (tokens.length > 0) {
      try {
        await pushSender.send(tokens, notification);
      } catch (error) {
        app.log.warn({ err: error, userId }, "push delivery failed");
      }
    }
    return notification;
  }

  async function attachMediaUrl<T extends { mediaObjectPath?: string }>(post: T): Promise<T> {
    if (!post.mediaObjectPath) return post;
    const mediaUrl = await mediaStorage.createDownloadUrl(post.mediaObjectPath);
    return mediaUrl ? { ...post, mediaUrl } : post;
  }

  async function attachMediaUrls<T extends { mediaObjectPath?: string }>(posts: T[]): Promise<T[]> {
    return Promise.all(posts.map(attachMediaUrl));
  }

  async function attachWorkoutSummary(post: FeedPost): Promise<FeedPost> {
    if (!post.workoutSessionId) return post;
    const workout = (await dependencies.store.listWorkoutSessions(post.userId)).find(
      (item) => item.id === post.workoutSessionId,
    );
    if (!workout) return post;
    return {
      ...post,
      workoutSummary: {
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        metrics: workout.metrics,
      },
    };
  }

  async function presentFeedPosts(posts: FeedPost[]) {
    return Promise.all(posts.map(async (post) => attachMediaUrl(await attachWorkoutSummary(post))));
  }

  await app.register(helmet);
  await app.register(cors, {
    origin: dependencies.config.corsOrigins,
    credentials: false,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  async function currentIdentity(
    request: FastifyRequest,
  ): Promise<{ user: User; sessionId: string }> {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
    }
    const identity = await tokenService.verifyAccessToken(header.slice(7));
    const session = await dependencies.store.findAuthSessionById(identity.sessionId);
    if (
      !session ||
      session.userId !== identity.userId ||
      session.revokedAt ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      throw new AppError(401, "AUTH_SESSION_EXPIRED", "로그인 세션이 만료되었습니다.");
    }
    const userById = await dependencies.store.findUserById(identity.userId);
    if (!userById) throw new AppError(401, "AUTH_INVALID", "사용자를 찾을 수 없습니다.");
    return { user: userById, sessionId: identity.sessionId };
  }

  async function currentUser(request: FastifyRequest): Promise<User> {
    return (await currentIdentity(request)).user;
  }

  async function optionalCurrentUser(request: FastifyRequest): Promise<User | null> {
    return request.headers.authorization ? currentUser(request) : null;
  }

  async function currentAdmin(request: FastifyRequest): Promise<User> {
    const user = await currentUser(request);
    if (!dependencies.config.adminEmails.includes(user.email.toLowerCase())) {
      throw new AppError(403, "ADMIN_REQUIRED", "관리자 권한이 필요합니다.");
    }
    return user;
  }

  async function issueSession(user: User) {
    const refreshToken = tokenService.createRefreshToken();
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const authSession = await dependencies.store.createAuthSession({
      userId: user.id,
      refreshTokenHash: tokenService.hashRefreshToken(refreshToken),
      expiresAt,
    });
    return {
      accessToken: await tokenService.signAccessToken(user.id, authSession.id),
      refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  async function seedDevelopmentAccount(user: User): Promise<void> {
    const now = Date.now();
    const workoutInputs = [
      {
        sport: "running" as const,
        startedAt: new Date(now - 2 * 86_400_000 - 34 * 60_000).toISOString(),
        endedAt: new Date(now - 2 * 86_400_000).toISOString(),
        perceivedExertion: 6,
        notes: "한강 이지런 · 마지막 5분만 가볍게 페이스 업",
        metrics: { distanceKm: 5.24, calories: 384, paceSeconds: 370 },
        source: "manual" as const,
      },
      {
        sport: "swimming" as const,
        startedAt: new Date(now - 4 * 86_400_000 - 42 * 60_000).toISOString(),
        endedAt: new Date(now - 4 * 86_400_000).toISOString(),
        perceivedExertion: 5,
        notes: "자유형 호흡과 스트림라인에 집중",
        metrics: { distanceKm: 1.2, calories: 310, laps: 48 },
        source: "manual" as const,
      },
      {
        sport: "strength" as const,
        startedAt: new Date(now - 6 * 86_400_000 - 51 * 60_000).toISOString(),
        endedAt: new Date(now - 6 * 86_400_000).toISOString(),
        perceivedExertion: 7,
        notes: "스쿼트 · 벤치프레스 · 로우 전신 루틴",
        metrics: { calories: 428, sets: 16, volumeKg: 6240 },
        source: "manual" as const,
      },
    ];
    const workouts = await Promise.all(
      workoutInputs.map((input) => dependencies.store.createWorkoutSession(user.id, input)),
    );

    await Promise.all([
      dependencies.store.createRoutine(user.id, {
        title: "수영 베이스 1.2K",
        sport: "swimming",
        daysOfWeek: [2, 5],
        items: [
          { name: "워밍업", target: "자유형 200m", order: 0 },
          { name: "메인", target: "100m × 8", order: 1 },
          { name: "쿨다운", target: "200m", order: 2 },
        ],
      }),
      dependencies.store.createRoutine(user.id, {
        title: "5K 리듬 러닝",
        sport: "running",
        daysOfWeek: [1, 3, 6],
        items: [
          { name: "이지런", target: "30분 대화 가능한 강도", order: 0 },
          { name: "스트라이드", target: "20초 × 4", order: 1 },
        ],
      }),
      dependencies.store.createRoutine(user.id, {
        title: "전신 스트렝스 A",
        sport: "strength",
        daysOfWeek: [1, 4],
        items: [
          { name: "스쿼트", target: "5회 · 5세트 · 예상 15분 · 휴식 2분", order: 0 },
          { name: "벤치프레스", target: "8회 · 4세트 · 예상 12분 · 휴식 2분", order: 1 },
          { name: "바벨 로우", target: "10회 · 4세트 · 예상 10분 · 휴식 1분", order: 2 },
        ],
      }),
    ]);

    const friendSeeds = [
      { email: "minji@groov.demo", displayName: "runner.minji" },
      { email: "jun@groov.demo", displayName: "pace_jun" },
      { email: "yuna@groov.demo", displayName: "lift.yuna" },
    ];
    const friends = await Promise.all(
      friendSeeds.map(
        async (seed) =>
          (await dependencies.store.findUserByEmail(seed.email)) ??
          dependencies.store.createUser({
            ...seed,
            passwordHash: await hashPassword(randomUUID() + randomUUID()),
          }),
      ),
    );
    await Promise.all(
      friends.flatMap((friend) => [
        dependencies.store.followUser(user.id, friend.id),
        dependencies.store.followUser(friend.id, user.id),
      ]),
    );

    const posts = await Promise.all([
      dependencies.store.createPost(user.id, user.displayName, {
        sport: "running",
        content: "5.24KM. 오늘도 기록보다 리듬을 남겼다.",
        contentType: "story",
        workoutSessionId: workouts[0]!.id,
      }),
      dependencies.store.createPost(user.id, user.displayName, {
        sport: "swimming",
        content: "오늘의 수영 1.2K · 스트림라인이 조금씩 길어진다.",
        contentType: "post",
        workoutSessionId: workouts[1]!.id,
      }),
      dependencies.store.createPost(user.id, user.displayName, {
        sport: "strength",
        content: "무게보다 자세. 전신 스트렝스 루틴 완료.",
        contentType: "post",
        workoutSessionId: workouts[2]!.id,
      }),
    ]);
    if (posts[0] && friends[0])
      await dependencies.store.createComment(
        friends[0].id,
        friends[0].displayName,
        posts[0].id,
        "리듬 좋은 기록! 다음 러닝도 같이 가요.",
      );
    if (friends[0])
      await dependencies.store.createMessage(
        friends[0].id,
        user.id,
        "이번 주말 한강 이지런 어때요?",
      );
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          requestId: request.id,
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }

    request.log.error({ err: error }, "unhandled request error");
    return reply.status(500).send({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "요청을 처리하지 못했습니다.",
        requestId: request.id,
      },
    });
  });

  app.get("/health", async () =>
    success({
      status: "ok",
      service: "groov-api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/ready", async () => {
    try {
      await dependencies.store.healthCheck();
      return success({
        status: "ready",
        service: "groov-api",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      app.log.error({ err: error }, "readiness check failed");
      throw new AppError(503, "SERVICE_NOT_READY", "데이터베이스 연결을 확인해 주세요.");
    }
  });

  app.post(
    "/v1/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = RegisterInputSchema.parse(request.body);
      const existing = await dependencies.store.findUserByEmail(input.email);
      if (existing) {
        throw new AppError(409, "EMAIL_EXISTS", "이미 가입된 이메일입니다.");
      }

      const user = await dependencies.store.createUser({
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
      });
      return reply.status(201).send(success(await issueSession(user)));
    },
  );

  app.post(
    "/v1/auth/google",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const input = GoogleLoginInputSchema.parse(request.body);
      const identity = await googleTokenVerifier(
        input.idToken,
        dependencies.config.googleClientIds,
      );
      const user = await dependencies.store.findOrCreateOAuthUser({
        provider: "google",
        ...identity,
      });
      return success(await issueSession(user));
    },
  );

  app.post(
    "/v1/auth/apple",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const input = AppleLoginInputSchema.parse(request.body);
      const identity = await appleTokenVerifier(
        input.identityToken,
        dependencies.config.appleClientIds,
      );
      if (input.email && input.email !== identity.email) {
        throw new AppError(401, "APPLE_EMAIL_MISMATCH", "Apple 계정 정보가 일치하지 않습니다.");
      }
      const fallbackDisplayName =
        identity.email
          .split("@")[0]!
          .replace(/[^A-Za-z0-9._]/g, "")
          .slice(0, 30) || "GROOV 사용자";
      const user = await dependencies.store.findOrCreateOAuthUser({
        provider: "apple",
        ...identity,
        displayName:
          input.displayName ??
          (fallbackDisplayName.length >= 2 ? fallbackDisplayName : "GROOV 사용자"),
      });
      return success(await issueSession(user));
    },
  );

  app.post(
    "/v1/auth/kakao",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const input = AuthorizationCodeLoginInputSchema.parse(request.body);
      const identity = await kakaoCodeExchanger(
        input,
        dependencies.config.kakaoRestApiKey,
        dependencies.config.kakaoClientSecret,
      );
      const user = await dependencies.store.findOrCreateOAuthUser({
        provider: "kakao",
        ...identity,
      });
      return success(await issueSession(user));
    },
  );

  app.post(
    "/v1/auth/naver",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const input = AuthorizationCodeLoginInputSchema.parse(request.body);
      const identity = await naverCodeExchanger(
        input,
        dependencies.config.naverClientId,
        dependencies.config.naverClientSecret,
      );
      const user = await dependencies.store.findOrCreateOAuthUser({
        provider: "naver",
        ...identity,
      });
      return success(await issueSession(user));
    },
  );

  if (dependencies.config.nodeEnv === "development" && dependencies.config.devAuthBypass) {
    app.post(
      "/v1/auth/development",
      { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
      async () => {
        const email = "developer@groov.dev";
        let user = await dependencies.store.findUserByEmail(email);
        if (!user) {
          user = await dependencies.store.createUser({
            email,
            displayName: "GROOV 개발자",
            passwordHash: await hashPassword(randomUUID() + randomUUID()),
          });
          await seedDevelopmentAccount(user);
        }
        return success(await issueSession(user));
      },
    );
  }

  app.get("/v1/auth/me", async (request) => {
    const user = await currentUser(request);
    return success({ id: user.id, email: user.email, displayName: user.displayName });
  });

  app.post(
    "/v1/auth/refresh",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const input = RefreshSessionInputSchema.parse(request.body);
      const current = await dependencies.store.findAuthSessionByRefreshTokenHash(
        tokenService.hashRefreshToken(input.refreshToken),
      );
      if (!current || current.revokedAt || Date.parse(current.expiresAt) <= Date.now()) {
        throw new AppError(401, "REFRESH_TOKEN_INVALID", "다시 로그인해 주세요.");
      }
      const user = await dependencies.store.findUserById(current.userId);
      if (!user) throw new AppError(401, "AUTH_INVALID", "사용자를 찾을 수 없습니다.");
      const refreshToken = tokenService.createRefreshToken();
      const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const rotated = await dependencies.store.rotateAuthSession({
        sessionId: current.id,
        refreshTokenHash: tokenService.hashRefreshToken(refreshToken),
        expiresAt,
      });
      if (!rotated) throw new AppError(401, "REFRESH_TOKEN_INVALID", "다시 로그인해 주세요.");
      return success({
        accessToken: await tokenService.signAccessToken(user.id, rotated.id),
        refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    },
  );

  app.post("/v1/auth/logout", async (request) => {
    const identity = await currentIdentity(request);
    await dependencies.store.revokeAuthSession(identity.sessionId);
    return success({ loggedOut: true as const });
  });

  app.get("/v1/users/me/profile", async (request) => {
    const user = await currentUser(request);
    return success({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      ...(user.avatarDataUri ? { avatarDataUri: user.avatarDataUri } : {}),
    });
  });

  app.patch("/v1/users/me/profile", async (request) => {
    const user = await currentUser(request);
    const input = ProfileUpdateInputSchema.parse(request.body);
    if (
      input.displayName &&
      (await dependencies.store.isDisplayNameTaken(input.displayName, user.id))
    ) {
      throw new AppError(409, "NICKNAME_EXISTS", "이미 사용 중인 닉네임입니다.");
    }
    const updated = await dependencies.store.updateUserProfile(user.id, input);
    if (!updated) throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    return success({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      ...(updated.avatarDataUri ? { avatarDataUri: updated.avatarDataUri } : {}),
    });
  });

  app.get("/v1/users/me/onboarding", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.getOnboarding(user.id));
  });

  app.put("/v1/users/me/onboarding", async (request) => {
    const user = await currentUser(request);
    const input = OnboardingInputSchema.parse(request.body);
    const privacySafeInput = input.neighborhood
      ? {
          ...input,
          neighborhood: {
            ...input.neighborhood,
            latitude: Number(input.neighborhood.latitude.toFixed(2)),
            longitude: Number(input.neighborhood.longitude.toFixed(2)),
          },
        }
      : input;
    return success(await dependencies.store.saveOnboarding(user.id, privacySafeInput));
  });

  app.get("/v1/auth/providers", async () =>
    success({
      google: dependencies.config.googleClientIds.length > 0,
      apple: dependencies.config.appleClientIds.length > 0,
      kakao: Boolean(dependencies.config.kakaoRestApiKey),
      naver: Boolean(dependencies.config.naverClientId && dependencies.config.naverClientSecret),
      development:
        dependencies.config.nodeEnv === "development" && dependencies.config.devAuthBypass,
    }),
  );

  app.post(
    "/v1/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request) => {
      const input = LoginInputSchema.parse(request.body);
      const user = await dependencies.store.findUserByEmail(input.email);
      if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
        throw new AppError(401, "LOGIN_FAILED", "이메일 또는 비밀번호가 올바르지 않습니다.");
      }

      return success(await issueSession(user));
    },
  );

  app.get("/v1/account/sessions", async (request) => {
    const identity = await currentIdentity(request);
    return success(
      (await dependencies.store.listAuthSessions(identity.user.id)).map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        current: session.id === identity.sessionId,
      })),
    );
  });

  app.delete("/v1/account/sessions/:sessionId", async (request) => {
    const identity = await currentIdentity(request);
    const parameters = z.object({ sessionId: z.uuid() }).parse(request.params);
    const sessions = await dependencies.store.listAuthSessions(identity.user.id);
    if (!sessions.some((session) => session.id === parameters.sessionId)) {
      throw new AppError(404, "SESSION_NOT_FOUND", "로그인 세션을 찾을 수 없습니다.");
    }
    await dependencies.store.revokeAuthSession(parameters.sessionId);
    return success({ revoked: true as const });
  });

  app.put("/v1/account/password", async (request) => {
    const user = await currentUser(request);
    const input = PasswordChangeInputSchema.parse(request.body);
    if (!user.passwordHash) {
      throw new AppError(400, "PASSWORD_NOT_SET", "Google 계정에는 별도 비밀번호가 없습니다.");
    }
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError(401, "PASSWORD_INVALID", "현재 비밀번호가 올바르지 않습니다.");
    }
    if (await verifyPassword(user.passwordHash, input.newPassword)) {
      throw new AppError(400, "PASSWORD_REUSED", "기존과 다른 비밀번호를 사용해 주세요.");
    }
    await dependencies.store.updatePassword(user.id, await hashPassword(input.newPassword));
    return success(await issueSession((await dependencies.store.findUserById(user.id))!));
  });

  app.delete("/v1/account", async (request) => {
    const user = await currentUser(request);
    const input = AccountDeletionInputSchema.parse(request.body);
    if (user.passwordHash) {
      if (
        !input.currentPassword ||
        !(await verifyPassword(user.passwordHash, input.currentPassword))
      ) {
        throw new AppError(401, "PASSWORD_INVALID", "현재 비밀번호를 확인해 주세요.");
      }
    }
    const media = await dependencies.store.listMediaObjects(user.id);
    for (const item of media) await mediaStorage.removeObject(item.objectPath);
    if (!(await dependencies.store.deleteUserAccount(user.id))) {
      throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    }
    return success({ deleted: true as const });
  });

  app.get("/v1/consents/me", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.getConsent(user.id));
  });

  app.put("/v1/consents/me", async (request) => {
    const user = await currentUser(request);
    const input = ConsentUpdateInputSchema.parse(request.body);
    return success(await dependencies.store.saveConsent(user.id, input));
  });

  app.post("/v1/media/upload-ticket", async (request, reply) => {
    const user = await currentUser(request);
    const input = MediaUploadRequestInputSchema.parse(request.body);
    const ticket = await mediaStorage.createUploadTicket({
      userId: user.id,
      kind: input.kind,
      contentType: input.contentType,
    });
    const media = await dependencies.store.createMediaObject({
      userId: user.id,
      provider: "supabase",
      bucket: mediaStorage.bucket,
      objectPath: ticket.objectPath,
      kind: input.kind,
      contentType: input.contentType,
      byteSize: input.byteSize,
    });
    return reply.status(201).send(success({ ...ticket, mediaId: media.id }));
  });

  app.post("/v1/media/:mediaId/complete", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ mediaId: z.uuid() }).parse(request.params);
    const pending = await dependencies.store.findMediaObject(user.id, parameters.mediaId);
    if (!pending || pending.status !== "pending") {
      throw new AppError(404, "MEDIA_NOT_FOUND", "업로드 항목을 찾을 수 없습니다.");
    }
    const uploaded = await mediaStorage.inspectObject(pending.objectPath);
    if (
      !uploaded ||
      uploaded.byteSize === null ||
      uploaded.contentType === null ||
      uploaded.byteSize !== pending.byteSize ||
      uploaded.contentType !== pending.contentType
    ) {
      if (uploaded) await mediaStorage.removeObject(pending.objectPath);
      throw new AppError(
        400,
        "MEDIA_VALIDATION_FAILED",
        "업로드한 파일의 형식 또는 크기가 요청 내용과 일치하지 않습니다.",
      );
    }
    const media = await dependencies.store.markMediaObjectAvailable(user.id, parameters.mediaId);
    if (!media) throw new AppError(404, "MEDIA_NOT_FOUND", "업로드 항목을 찾을 수 없습니다.");
    return success({ id: media.id, status: media.status, objectPath: media.objectPath });
  });

  app.get("/v1/sports", async () => success(sports));

  app.get("/v1/knowledge/:sport", async (request) => {
    const parameters = z.object({ sport: SportTypeSchema }).parse(request.params);
    const articles = knowledgeArticles.filter((article) => article.sport === parameters.sport);
    return success(
      await Promise.all(
        articles.map(async (article) => ({
          ...article,
          feedback: await dependencies.store.listKnowledgeFeedback(article.id),
        })),
      ),
    );
  });

  app.post("/v1/knowledge/:articleId/feedback", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z
      .object({
        articleId: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(100),
      })
      .parse(request.params);
    if (!knowledgeArticles.some((article) => article.id === parameters.articleId)) {
      throw new AppError(404, "ARTICLE_NOT_FOUND", "지식 콘텐츠를 찾을 수 없습니다.");
    }
    const input = KnowledgeFeedbackCreateInputSchema.parse(request.body);
    const feedback = await dependencies.store.createKnowledgeFeedback(
      user.id,
      user.displayName,
      parameters.articleId,
      input,
    );
    return reply.status(201).send(success(feedback));
  });

  app.get("/v1/routines/me", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.listRoutines(user.id));
  });

  app.post("/v1/routines", async (request, reply) => {
    const user = await currentUser(request);
    const input = RoutineCreateInputSchema.parse(request.body);
    const routine = await dependencies.store.createRoutine(user.id, input);
    return reply.status(201).send(success(routine));
  });

  app.put("/v1/routines/order", async (request) => {
    const user = await currentUser(request);
    const input = RoutineReorderInputSchema.parse(request.body);
    const reordered = await dependencies.store.reorderRoutines(user.id, input.routineIds);
    if (!reordered) {
      throw new AppError(400, "ROUTINE_ORDER_INVALID", "루틴 순서를 다시 확인해 주세요.");
    }
    return success(await dependencies.store.listRoutines(user.id));
  });

  app.patch("/v1/routines/:routineId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ routineId: z.uuid() }).parse(request.params);
    const input = RoutineUpdateInputSchema.parse(request.body);
    const routine = await dependencies.store.updateRoutine(user.id, parameters.routineId, input);
    if (!routine) throw new AppError(404, "ROUTINE_NOT_FOUND", "루틴을 찾을 수 없습니다.");
    return success(routine);
  });

  app.delete("/v1/routines/:routineId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ routineId: z.uuid() }).parse(request.params);
    const deleted = await dependencies.store.deleteRoutine(user.id, parameters.routineId);
    if (!deleted) throw new AppError(404, "ROUTINE_NOT_FOUND", "루틴을 찾을 수 없습니다.");
    return success({ deleted: true as const });
  });

  app.post("/v1/workout-sessions", { bodyLimit: 8_000_000 }, async (request, reply) => {
    const user = await currentUser(request);
    const input = WorkoutSessionCreateInputSchema.parse(request.body);
    const session = await dependencies.store.createWorkoutSession(user.id, input);
    return reply.status(201).send(success(session));
  });

  app.get("/v1/workout-sessions/me", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.listWorkoutSessions(user.id));
  });

  app.patch("/v1/workout-sessions/:workoutId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ workoutId: z.uuid() }).parse(request.params);
    const input = WorkoutSessionUpdateInputSchema.parse(request.body);
    const workout = await dependencies.store.updateWorkoutSession(
      user.id,
      parameters.workoutId,
      input,
    );
    if (!workout) {
      throw new AppError(404, "WORKOUT_NOT_FOUND", "운동 기록을 찾을 수 없습니다.");
    }
    return success(workout);
  });

  app.delete("/v1/workout-sessions/:workoutId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ workoutId: z.uuid() }).parse(request.params);
    const deleted = await dependencies.store.deleteWorkoutSession(user.id, parameters.workoutId);
    if (!deleted) {
      throw new AppError(404, "WORKOUT_NOT_FOUND", "운동 기록을 찾을 수 없습니다.");
    }
    return success({ deleted: true as const });
  });

  app.get("/v1/medals/me", async (request) => {
    const user = await currentUser(request);
    return success(medalsFor(await dependencies.store.listWorkoutSessions(user.id)));
  });

  app.get("/v1/feed", async (request) => {
    const viewer = await optionalCurrentUser(request);
    return success(await presentFeedPosts(await dependencies.store.listFeed(viewer?.id)));
  });

  app.get("/v1/posts/:postId", async (request) => {
    const viewer = request.headers.authorization ? await currentUser(request) : null;
    const { postId } = z.object({ postId: z.uuid() }).parse(request.params);
    const [post] = await dependencies.store.listFeed(viewer?.id, postId);
    if (!post)
      throw new AppError(404, "POST_NOT_FOUND", "삭제·보관되었거나 볼 수 없는 피드입니다.");
    return success((await presentFeedPosts([post]))[0]!);
  });

  app.get("/v1/sharing-crews", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.listSharingCrews(user.id));
  });
  app.post("/v1/sharing-crews", async (request, reply) => {
    const user = await currentUser(request);
    const input = SharingCrewCreateInputSchema.parse(request.body);
    const crew = await dependencies.store.createSharingCrew(user.id, input);
    if (!crew)
      throw new AppError(400, "CREW_MEMBERS_INVALID", "크루에 포함할 대상을 다시 확인해 주세요.");
    return reply.status(201).send(success(crew));
  });
  app.post("/v1/posts", async (request, reply) => {
    const user = await currentUser(request);
    const input = PostCreateInputSchema.parse(request.body);
    const selectedCrews = [input.audience, input.commentAudience]
      .filter((audience) => audience?.scope === "crews")
      .flatMap((audience) => audience?.crewIds ?? []);
    if (selectedCrews.length) {
      const ownedCrews = await dependencies.store.listSharingCrews(user.id);
      if (selectedCrews.some((id) => !ownedCrews.some((crew) => crew.id === id)))
        throw new AppError(400, "CREW_NOT_FOUND", "본인의 공유 크루를 다시 선택해 주세요.");
    }
    const post = await dependencies.store.createPost(user.id, user.displayName, input);
    if (!post) {
      throw new AppError(
        404,
        "WORKOUT_NOT_FOUND",
        "본인의 운동 기록만 게시물에 연결할 수 있습니다.",
      );
    }
    return reply.status(201).send(success((await presentFeedPosts([post]))[0]!));
  });

  app.get("/v1/posts/me", async (request) => {
    const user = await currentUser(request);
    return success(await attachMediaUrls(await dependencies.store.listPostsByUser(user.id)));
  });

  app.get("/v1/posts/me/archive", async (request) => {
    const user = await currentUser(request);
    return success(
      await attachMediaUrls(await dependencies.store.listArchivedPostsByUser(user.id)),
    );
  });

  app.patch("/v1/posts/:postId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const input = PostUpdateInputSchema.parse(request.body);
    const post = await dependencies.store.updatePost(user.id, parameters.postId, input);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return success(await attachMediaUrl(post));
  });

  app.post("/v1/posts/:postId/archive", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const post = await dependencies.store.setPostArchived(user.id, parameters.postId, true);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return success(await attachMediaUrl(post));
  });

  app.delete("/v1/posts/:postId/archive", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const post = await dependencies.store.setPostArchived(user.id, parameters.postId, false);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return success(await attachMediaUrl(post));
  });

  app.delete("/v1/posts/:postId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    if (!(await dependencies.store.deletePost(user.id, parameters.postId))) {
      throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    }
    return success({ deleted: true });
  });

  app.get("/v1/users/:userId/posts", async (request) => {
    const viewer = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    const profile = await dependencies.store.findUserById(parameters.userId);
    if (!profile) throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    return success({
      user: {
        id: profile.id,
        displayName: profile.displayName,
        ...(profile.avatarDataUri ? { avatarDataUri: profile.avatarDataUri } : {}),
      },
      posts: await attachMediaUrls(await dependencies.store.listPostsByUser(profile.id, viewer.id)),
    });
  });

  app.get("/v1/users/:userId/profile", async (request) => {
    const viewer = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    const profile = await dependencies.store.findUserById(parameters.userId);
    if (!profile) throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const visible = await dependencies.store.canViewContent(profile.id, viewer.id);
    const [posts, workouts, followers, following] = await Promise.all([
      dependencies.store.listPostsByUser(profile.id, viewer.id),
      dependencies.store.listWorkoutSessions(profile.id),
      dependencies.store.listFollowers(profile.id),
      dependencies.store.listFollowing(profile.id),
    ]);
    return success({
      user: {
        id: profile.id,
        displayName: profile.displayName,
        ...(profile.avatarDataUri ? { avatarDataUri: profile.avatarDataUri } : {}),
      },
      isPrivate: !visible,
      followersCount: followers.length,
      followingCount: following.length,
      posts: await attachMediaUrls(posts),
      workouts: (visible ? workouts : []).map(({ routePoints, ...workout }) =>
        profile.id === viewer.id ? { ...workout, routePoints } : workout,
      ),
      medals: visible ? medalsFor(workouts) : [],
    });
  });

  app.get("/v1/users/:userId/connections", async (request) => {
    const viewer = await currentUser(request);
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
    if (!(await dependencies.store.findUserById(userId)))
      throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const [visible, privacy, followers, following] = await Promise.all([
      dependencies.store.canViewContent(userId, viewer.id),
      dependencies.store.safetySummary(userId),
      dependencies.store.listFollowers(userId),
      dependencies.store.listFollowing(userId),
    ]);
    const followersHidden = viewer.id !== userId && (!visible || privacy.hideFollowers);
    const followingHidden = viewer.id !== userId && (!visible || privacy.hideFollowing);
    return success({
      followersCount: followers.length,
      followingCount: following.length,
      followersHidden,
      followingHidden,
      followers: followersHidden ? [] : followers,
      following: followingHidden ? [] : following,
    });
  });

  app.get("/v1/social/safety", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.safetySummary(user.id));
  });
  app.put("/v1/social/privacy", async (request) => {
    const user = await currentUser(request);
    const privacy = z
      .object({ hideFollowers: z.boolean(), hideFollowing: z.boolean() })
      .strict()
      .parse(request.body);
    await dependencies.store.saveSocialPrivacy(user.id, privacy);
    return success(privacy);
  });
  app.delete("/v1/users/:userId/block", async (request) => {
    const user = await currentUser(request);
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
    await dependencies.store.unblockUser(user.id, userId);
    return success({ blocked: false });
  });
  for (const method of ["PUT", "DELETE"] as const) {
    app.route({
      method,
      url: "/v1/users/:userId/restriction",
      handler: async (request) => {
        const user = await currentUser(request);
        const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
        if (!(await dependencies.store.restrictUser(user.id, userId, method === "PUT")))
          throw new AppError(400, "INVALID_USER", "사용자를 찾을 수 없습니다.");
        return success({ restricted: method === "PUT" });
      },
    });
  }

  app.get("/v1/social/suggestions", async (request) => {
    const user = await currentUser(request);
    const [people, history] = await Promise.all([
      dependencies.store.listFollowing(user.id),
      dependencies.store.shareFrequency(user.id),
    ]);
    return success(rankSocialPeople(people, history));
  });

  app.get("/v1/social/me", async (request) => {
    const user = await currentUser(request);
    const [followers, following] = await Promise.all([
      dependencies.store.listFollowers(user.id),
      dependencies.store.listFollowing(user.id),
    ]);
    return success({
      followersCount: followers.length,
      followingCount: following.length,
      followers,
      following,
    });
  });

  app.get("/v1/users/:userId/follow-status", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    const [following, followers] = await Promise.all([
      dependencies.store.isFollowing(user.id, parameters.userId),
      dependencies.store.listFollowers(parameters.userId),
    ]);
    return success({ following, followersCount: followers.length });
  });

  app.post("/v1/users/:userId/follow", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    if (!(await dependencies.store.followUser(user.id, parameters.userId))) {
      throw new AppError(400, "FOLLOW_NOT_ALLOWED", "이 사용자를 팔로우할 수 없습니다.");
    }
    await notifyUser(parameters.userId, {
      kind: "follow",
      title: "새 팔로워",
      body: `${user.displayName}님이 회원님을 팔로우하기 시작했습니다.`,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
    });
    return reply.status(201).send(success({ following: true }));
  });

  app.delete("/v1/users/:userId/follow", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    await dependencies.store.unfollowUser(user.id, parameters.userId);
    return success({ following: false });
  });

  app.delete("/v1/users/:userId/follower", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    await dependencies.store.removeFollower(user.id, parameters.userId);
    return success({ removed: true });
  });

  app.post("/v1/users/:userId/block", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    if (!(await dependencies.store.blockUser(user.id, parameters.userId))) {
      throw new AppError(400, "BLOCK_NOT_ALLOWED", "이 사용자를 차단할 수 없습니다.");
    }
    return success({ blocked: true });
  });

  app.post("/v1/reports", async (request, reply) => {
    const user = await currentUser(request);
    const input = ContentReportCreateInputSchema.parse(request.body);
    const report = await dependencies.store.createContentReport(user.id, input);
    await Promise.all(
      dependencies.config.adminEmails.map(async (email) => {
        const admin = await dependencies.store.findUserByEmail(email);
        if (!admin) return;
        await notifyUser(admin.id, {
          kind: "moderation",
          title: "새 신고 접수",
          body: `${input.targetType} 콘텐츠 신고가 접수되었습니다.`,
          actorId: user.id,
          resourceType: "report",
          resourceId: report.id,
        });
      }),
    );
    return reply.status(201).send(success(report));
  });

  app.get("/v1/notifications", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.listNotifications(user.id));
  });

  app.put("/v1/notifications/push-device", async (request) => {
    const user = await currentUser(request);
    const input = PushDeviceRegistrationInputSchema.parse(request.body);
    const device = await dependencies.store.registerPushDevice(user.id, input);
    return success({
      id: device.id,
      platform: device.platform,
      ...(device.deviceName ? { deviceName: device.deviceName } : {}),
      registeredAt: device.updatedAt,
    });
  });

  app.delete("/v1/notifications/push-device", async (request) => {
    const user = await currentUser(request);
    const { token } = PushDeviceRegistrationInputSchema.pick({ token: true }).parse(request.body);
    await dependencies.store.unregisterPushDevice(user.id, token);
    return success({ unregistered: true });
  });

  app.patch("/v1/notifications/:notificationId/read", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ notificationId: z.string().uuid() }).parse(request.params);
    const notification = await dependencies.store.markNotificationRead(
      user.id,
      parameters.notificationId,
    );
    if (!notification) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없습니다.");
    }
    return success(notification);
  });

  app.get("/v1/admin/reports", async (request) => {
    await currentAdmin(request);
    return success(await dependencies.store.listContentReports());
  });

  app.get("/v1/admin/usage-purposes", async (request, reply) => {
    await currentAdmin(request);
    const cohort = UsagePurposeCohortSchema.parse(request.query);
    reply.header("Cache-Control", "private, no-store");
    return success(
      await dependencies.store.usagePurposeSummary(cohort, [
        ...dependencies.config.adminEmails,
        "developer@groov.dev",
        "minji@groov.demo",
        "jun@groov.demo",
        "yuna@groov.demo",
      ]),
    );
  });

  app.patch("/v1/admin/reports/:reportId", async (request) => {
    await currentAdmin(request);
    const parameters = z.object({ reportId: z.string().uuid() }).parse(request.params);
    const input = ModerationReportUpdateInputSchema.parse(request.body);
    const report = await dependencies.store.updateContentReport(parameters.reportId, input);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "신고를 찾을 수 없습니다.");
    await notifyUser(report.reporterId, {
      kind: "moderation",
      title: "신고 처리 상태 변경",
      body:
        input.status === "resolved"
          ? "신고하신 내용을 확인하고 조치했습니다."
          : input.status === "dismissed"
            ? "신고하신 내용을 검토했습니다."
            : "운영팀이 신고 내용을 검토 중입니다.",
      resourceType: "report",
      resourceId: report.id,
    });
    return success(report);
  });

  app.get("/v1/messages/:userId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    return success(await dependencies.store.listMessages(user.id, parameters.userId));
  });

  app.post("/v1/messages/:userId", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    const input = DirectMessageCreateInputSchema.parse(request.body);
    const message = await dependencies.store.createMessage(
      user.id,
      parameters.userId,
      input.content,
    );
    if (!message) {
      throw new AppError(400, "MESSAGE_NOT_ALLOWED", "이 사용자에게 메시지를 보낼 수 없습니다.");
    }
    await notifyUser(parameters.userId, {
      kind: "message",
      title: "새 탭톡",
      body: `${user.displayName}님이 메시지를 보냈습니다.`,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
    });
    return reply.status(201).send(success(message));
  });

  app.post("/v1/posts/:postId/comments", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const input = CommentCreateInputSchema.parse(request.body);
    const source = (await dependencies.store.listFeed(user.id, parameters.postId))[0];
    if (!source) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    const followed = await dependencies.store.listFollowing(user.id);
    const mentions = [...(input.mentions ?? [])].sort((a, b) => a.start - b.start);
    let lastEnd = 0;
    for (const mention of mentions) {
      const person = followed.find((person) => person.id === mention.userId);
      if (
        !person ||
        person.displayName !== mention.displayName ||
        mention.start < lastEnd ||
        input.content.slice(mention.start, mention.end) !== `@${person.displayName}`
      ) {
        throw new AppError(400, "INVALID_MENTION", "멘션할 사용자를 다시 선택해 주세요.");
      }
      lastEnd = mention.end;
    }
    const comment = await dependencies.store.createComment(
      user.id,
      user.displayName,
      parameters.postId,
      input.content,
      input.parentCommentId,
      mentions,
    );
    if (!comment)
      throw new AppError(
        404,
        "COMMENT_NOT_ALLOWED",
        "댓글을 남길 게시물 또는 원본 댓글을 찾을 수 없습니다.",
      );
    const recipients = new Set([source.userId, ...mentions.map((mention) => mention.userId)]);
    const parent = source.comments.find((item) => item.id === input.parentCommentId);
    if (parent) recipients.add(parent.userId);
    await Promise.allSettled(
      [...recipients]
        .filter((id) => id !== user.id)
        .map(async (id) => {
          if (!(await dependencies.store.listFeed(id, source.id))[0]) return;
          const mentioned = mentions.some((mention) => mention.userId === id);
          await notifyUser(id, {
            kind: mentioned ? "mention" : "comment",
            title: mentioned ? "새 멘션" : "새 댓글",
            body: mentioned
              ? `${user.displayName}님이 댓글에서 회원님을 태그했습니다.`
              : `${user.displayName}님이 댓글을 남겼습니다.`,
            actorId: user.id,
            resourceType: "post",
            resourceId: source.id,
          });
        }),
    );
    return reply.status(201).send(success(comment));
  });

  for (const method of ["PUT", "DELETE"] as const) {
    app.route({
      method,
      url: "/v1/posts/:postId/comments/:commentId/like",
      handler: async (request) => {
        const user = await currentUser(request);
        const parameters = z
          .object({ postId: z.uuid(), commentId: z.uuid() })
          .parse(request.params);
        const previous = (
          await dependencies.store.listFeed(user.id, parameters.postId)
        )[0]?.comments.find((item) => item.id === parameters.commentId);
        const comment = await dependencies.store.setCommentLiked(
          user.id,
          parameters.postId,
          parameters.commentId,
          method === "PUT",
        );
        if (!comment) throw new AppError(404, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.");
        if (
          method === "PUT" &&
          !previous?.likedByMe &&
          comment.userId !== user.id &&
          (await dependencies.store.listFeed(comment.userId, parameters.postId))[0]
        ) {
          await notifyUser(comment.userId, {
            kind: "like",
            title: "댓글 좋아요",
            body: `${user.displayName}님이 댓글을 좋아합니다.`,
            actorId: user.id,
            resourceType: "post",
            resourceId: parameters.postId,
          });
        }
        return success(comment);
      },
    });
  }

  for (const method of ["PUT", "DELETE"] as const) {
    app.route({
      method,
      url: "/v1/posts/:postId/like",
      handler: async (request) => {
        const user = await currentUser(request);
        const { postId } = z.object({ postId: z.uuid() }).parse(request.params);
        const source = (await dependencies.store.listFeed(user.id, postId))[0];
        if (!source) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
        const result = await dependencies.store.setPostLiked(user.id, postId, method === "PUT");
        if (!result) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
        if (result.changed && result.liked && source.userId !== user.id) {
          await notifyUser(source.userId, {
            kind: "like",
            title: "게시물 좋아요",
            body: `${user.displayName}님이 게시물을 좋아합니다.`,
            actorId: user.id,
            resourceType: "post",
            resourceId: postId,
          });
        }
        return success(result);
      },
    });
  }

  app.post("/v1/posts/:postId/share", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const input = PostShareInputSchema.parse(request.body);
    const following = new Set(
      (await dependencies.store.listFollowing(user.id)).map((peer) => peer.id),
    );
    if (input.recipientIds.some((id) => id === user.id || !following.has(id))) {
      throw new AppError(
        400,
        "SHARE_RECIPIENT_NOT_ALLOWED",
        "공유 대상은 현재 팔로잉 중인 사람만 선택할 수 있습니다. 목록을 새로 불러와 주세요.",
      );
    }
    const result = await dependencies.store.sharePost(
      user.id,
      parameters.postId,
      input.recipientIds,
    );
    if (!result)
      throw new AppError(
        404,
        "SHARE_NOT_ALLOWED",
        "공유할 피드나 대상을 확인할 수 없습니다. 삭제·보관·차단 상태를 확인해 주세요.",
      );
    await Promise.allSettled(
      result.recipientIds.map((recipientId) =>
        notifyUser(recipientId, {
          kind: "share",
          title: "새 탭톡 · 피드 공유",
          body: `${user.displayName}님이 피드를 공유했습니다.`,
          actorId: user.id,
          resourceType: "user",
          resourceId: user.id,
        }),
      ),
    );
    return reply.status(201).send(success(result));
  });

  app.addHook("onClose", async () => dependencies.store.close());
  return app;
}
