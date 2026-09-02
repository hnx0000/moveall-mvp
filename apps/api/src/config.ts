import { z } from "zod";

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATA_STORE: z.enum(["memory", "postgres"]).default("memory"),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(20).default(5),
    DATABASE_SSL: z.enum(["require", "disable"]).default("require"),
    DATABASE_SSL_CA_FILE: z.string().min(1).optional(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET은 32자 이상이어야 합니다."),
    GOOGLE_CLIENT_IDS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((clientId) => clientId.trim())
          .filter(Boolean),
      ),
    APPLE_CLIENT_IDS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((clientId) => clientId.trim())
          .filter(Boolean),
      ),
    KAKAO_REST_API_KEY: z.string().min(1).optional(),
    KAKAO_CLIENT_SECRET: z.string().min(1).optional(),
    NAVER_CLIENT_ID: z.string().min(1).optional(),
    NAVER_CLIENT_SECRET: z.string().min(1).optional(),
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    DEV_AUTH_BYPASS: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    MEDIA_STORAGE: z.enum(["disabled", "supabase"]).default("disabled"),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(40).optional(),
    EXPO_PUSH_ACCESS_TOKEN: z.string().min(20).optional(),
    SUPABASE_MEDIA_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/)
      .default("groov-media"),
    CORS_ORIGINS: z
      .string()
      .default(
        "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006",
      )
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((value, context) => {
    if (value.DATA_STORE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATA_STORE=postgres일 때 DATABASE_URL이 필요합니다.",
      });
    }
    if (value.NODE_ENV === "production" && value.DATA_STORE !== "postgres") {
      context.addIssue({
        code: "custom",
        path: ["DATA_STORE"],
        message: "production 환경에서는 DATA_STORE=postgres가 필요합니다.",
      });
    }
    if (
      value.NODE_ENV === "production" &&
      value.AUTH_SECRET === "replace-with-at-least-32-random-characters"
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "production 환경에서는 예제 AUTH_SECRET을 사용할 수 없습니다.",
      });
    }
    if (value.NODE_ENV === "production" && value.GOOGLE_CLIENT_IDS.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_IDS"],
        message: "production 환경에서는 Google OAuth 클라이언트 ID가 필요합니다.",
      });
    }
    if (value.NODE_ENV === "production" && value.DEV_AUTH_BYPASS) {
      context.addIssue({
        code: "custom",
        path: ["DEV_AUTH_BYPASS"],
        message: "production 환경에서는 개발 인증 우회를 활성화할 수 없습니다.",
      });
    }
    if (
      value.MEDIA_STORAGE === "supabase" &&
      (!value.SUPABASE_URL || !value.SUPABASE_SERVICE_ROLE_KEY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "MEDIA_STORAGE=supabase일 때 Supabase URL과 service-role 키가 필요합니다.",
      });
    }
    if (value.NODE_ENV === "production" && value.MEDIA_STORAGE !== "supabase") {
      context.addIssue({
        code: "custom",
        path: ["MEDIA_STORAGE"],
        message: "production 환경에서는 Supabase 미디어 저장소가 필요합니다.",
      });
    }
  });

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  dataStore: "memory" | "postgres";
  databaseUrl?: string;
  databaseMaxConnections: number;
  databaseSsl: boolean;
  databaseSslCaFile?: string;
  authSecret: string;
  googleClientIds: string[];
  appleClientIds: string[];
  kakaoRestApiKey?: string;
  kakaoClientSecret?: string;
  naverClientId?: string;
  naverClientSecret?: string;
  adminEmails: string[];
  devAuthBypass: boolean;
  mediaStorage: "disabled" | "supabase";
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  expoPushAccessToken?: string;
  supabaseMediaBucket: string;
  corsOrigins: string[];
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const explanation = z.prettifyError(parsed.error);
    throw new Error("환경 설정이 올바르지 않습니다.\n" + explanation);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    dataStore: parsed.data.DATA_STORE,
    ...(parsed.data.DATABASE_URL ? { databaseUrl: parsed.data.DATABASE_URL } : {}),
    databaseMaxConnections: parsed.data.DATABASE_MAX_CONNECTIONS,
    databaseSsl: parsed.data.DATABASE_SSL === "require",
    ...(parsed.data.DATABASE_SSL_CA_FILE
      ? { databaseSslCaFile: parsed.data.DATABASE_SSL_CA_FILE }
      : {}),
    authSecret: parsed.data.AUTH_SECRET,
    googleClientIds: parsed.data.GOOGLE_CLIENT_IDS,
    appleClientIds: parsed.data.APPLE_CLIENT_IDS,
    ...(parsed.data.KAKAO_REST_API_KEY ? { kakaoRestApiKey: parsed.data.KAKAO_REST_API_KEY } : {}),
    ...(parsed.data.KAKAO_CLIENT_SECRET
      ? { kakaoClientSecret: parsed.data.KAKAO_CLIENT_SECRET }
      : {}),
    ...(parsed.data.NAVER_CLIENT_ID ? { naverClientId: parsed.data.NAVER_CLIENT_ID } : {}),
    ...(parsed.data.NAVER_CLIENT_SECRET
      ? { naverClientSecret: parsed.data.NAVER_CLIENT_SECRET }
      : {}),
    adminEmails: parsed.data.ADMIN_EMAILS,
    devAuthBypass:
      parsed.data.NODE_ENV === "development" &&
      (environment.DEV_AUTH_BYPASS === undefined || parsed.data.DEV_AUTH_BYPASS),
    mediaStorage: parsed.data.MEDIA_STORAGE,
    ...(parsed.data.SUPABASE_URL ? { supabaseUrl: parsed.data.SUPABASE_URL } : {}),
    ...(parsed.data.SUPABASE_SERVICE_ROLE_KEY
      ? { supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY }
      : {}),
    ...(parsed.data.EXPO_PUSH_ACCESS_TOKEN
      ? { expoPushAccessToken: parsed.data.EXPO_PUSH_ACCESS_TOKEN }
      : {}),
    supabaseMediaBucket: parsed.data.SUPABASE_MEDIA_BUCKET,
    corsOrigins: parsed.data.CORS_ORIGINS,
  };
}
