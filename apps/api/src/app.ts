import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  CommentCreateInputSchema,
  KnowledgeFeedbackCreateInputSchema,
  LoginInputSchema,
  PostCreateInputSchema,
  RegisterInputSchema,
  RoutineCreateInputSchema,
  SportTypeSchema,
  WorkoutSessionCreateInputSchema,
  type ApiSuccess,
} from "@moveall/contracts";
import Fastify, { type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import type { AppConfig } from "./config.js";
import { AppError } from "./domain/errors.js";
import type { AppStore, User } from "./domain/store.js";
import { knowledgeArticles, sports } from "./knowledge.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import { TokenService } from "./security/token.js";

type AppDependencies = {
  config: AppConfig;
  store: AppStore;
  logger?: boolean | Record<string, unknown>;
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
      service: "moveall-api",
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
    "/v1/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request) => {
      const input = LoginInputSchema.parse(request.body);
      const user = await dependencies.store.findUserByEmail(input.email);
      if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
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

  app.post("/v1/workout-sessions", async (request, reply) => {
    const user = await currentUser(request);
    const input = WorkoutSessionCreateInputSchema.parse(request.body);
    const session = await dependencies.store.createWorkoutSession(user.id, input);
    return reply.status(201).send(success(session));
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

  app.addHook("onClose", async () => dependencies.store.close());
  return app;
}
