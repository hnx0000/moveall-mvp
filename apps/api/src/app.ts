import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  CommentCreateInputSchema,
  DirectMessageCreateInputSchema,
  GoogleLoginInputSchema,
  KnowledgeFeedbackCreateInputSchema,
  LoginInputSchema,
  PostCreateInputSchema,
  PostUpdateInputSchema,
  ProfileUpdateInputSchema,
  RegisterInputSchema,
  RoutineCreateInputSchema,
  RoutineReorderInputSchema,
  RoutineUpdateInputSchema,
  SportTypeSchema,
  WorkoutSessionCreateInputSchema,
  WorkoutSessionUpdateInputSchema,
  type ApiSuccess,
} from "@moveall/contracts";
import Fastify, { type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import type { AppConfig } from "./config.js";
import { AppError } from "./domain/errors.js";
import type { AppStore, User } from "./domain/store.js";
import { knowledgeArticles, sports } from "./knowledge.js";
import { medalsFor } from "./medals.js";
import { verifyGoogleIdToken, type GoogleTokenVerifier } from "./security/google-identity.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import { TokenService } from "./security/token.js";

type AppDependencies = {
  config: AppConfig;
  store: AppStore;
  logger?: boolean | Record<string, unknown>;
  googleTokenVerifier?: GoogleTokenVerifier;
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

  await app.register(helmet);
  await app.register(cors, {
    origin: dependencies.config.corsOrigins,
    credentials: false,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  async function currentUser(request: FastifyRequest): Promise<User> {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
    }
    const userId = await tokenService.verify(header.slice(7));
    const userById = await dependencies.store.findUserById(userId);
    if (!userById) throw new AppError(401, "AUTH_INVALID", "사용자를 찾을 수 없습니다.");
    return userById;
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
      const accessToken = await tokenService.sign(user.id);
      return reply.status(201).send(
        success({
          accessToken,
          user: { id: user.id, email: user.email, displayName: user.displayName },
        }),
      );
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
      return success({
        accessToken: await tokenService.sign(user.id),
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
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
        return success({
          accessToken: await tokenService.sign(user.id),
          user: { id: user.id, email: user.email, displayName: user.displayName },
        });
      },
    );
  }

  app.get("/v1/auth/me", async (request) => {
    const user = await currentUser(request);
    return success({ id: user.id, email: user.email, displayName: user.displayName });
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

  app.get("/v1/auth/providers", async () =>
    success({
      google: dependencies.config.googleClientIds.length > 0,
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

      return success({
        accessToken: await tokenService.sign(user.id),
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    },
  );

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

  app.post("/v1/workout-sessions", async (request, reply) => {
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

  app.get("/v1/feed", async () => success(await dependencies.store.listFeed()));

  app.post("/v1/posts", async (request, reply) => {
    const user = await currentUser(request);
    const input = PostCreateInputSchema.parse(request.body);
    const post = await dependencies.store.createPost(user.id, user.displayName, input);
    if (!post) {
      throw new AppError(
        404,
        "WORKOUT_NOT_FOUND",
        "본인의 운동 기록만 게시물에 연결할 수 있습니다.",
      );
    }
    return reply.status(201).send(success(post));
  });

  app.get("/v1/posts/me", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.listPostsByUser(user.id));
  });

  app.get("/v1/posts/me/archive", async (request) => {
    const user = await currentUser(request);
    return success(await dependencies.store.listArchivedPostsByUser(user.id));
  });

  app.patch("/v1/posts/:postId", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const input = PostUpdateInputSchema.parse(request.body);
    const post = await dependencies.store.updatePost(user.id, parameters.postId, input);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return success(post);
  });

  app.post("/v1/posts/:postId/archive", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const post = await dependencies.store.setPostArchived(user.id, parameters.postId, true);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return success(post);
  });

  app.delete("/v1/posts/:postId/archive", async (request) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const post = await dependencies.store.setPostArchived(user.id, parameters.postId, false);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return success(post);
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
    await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    const profile = await dependencies.store.findUserById(parameters.userId);
    if (!profile) throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    return success({
      user: {
        id: profile.id,
        displayName: profile.displayName,
        ...(profile.avatarDataUri ? { avatarDataUri: profile.avatarDataUri } : {}),
      },
      posts: await dependencies.store.listPostsByUser(profile.id),
    });
  });

  app.get("/v1/users/:userId/profile", async (request) => {
    await currentUser(request);
    const parameters = z.object({ userId: z.string().uuid() }).parse(request.params);
    const profile = await dependencies.store.findUserById(parameters.userId);
    if (!profile) throw new AppError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const [posts, workouts, followers, following] = await Promise.all([
      dependencies.store.listPostsByUser(profile.id),
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
      isPrivate: false,
      followersCount: followers.length,
      followingCount: following.length,
      posts,
      workouts,
      medals: medalsFor(workouts),
    });
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
    return reply.status(201).send(success(message));
  });

  app.post("/v1/posts/:postId/comments", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const input = CommentCreateInputSchema.parse(request.body);
    const comment = await dependencies.store.createComment(
      user.id,
      user.displayName,
      parameters.postId,
      input.content,
    );
    if (!comment) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return reply.status(201).send(success(comment));
  });

  app.post("/v1/posts/:postId/share", async (request, reply) => {
    const user = await currentUser(request);
    const parameters = z.object({ postId: z.string().uuid() }).parse(request.params);
    const result = await dependencies.store.sharePost(user.id, parameters.postId);
    if (!result) throw new AppError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    return reply.status(201).send(success(result));
  });

  app.addHook("onClose", async () => dependencies.store.close());
  return app;
}
