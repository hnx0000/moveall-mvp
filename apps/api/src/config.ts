import { z } from "zod";

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATA_STORE: z.enum(["memory", "postgres"]).default("memory"),
    DATABASE_URL: z.string().min(1).optional(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET은 32자 이상이어야 합니다."),
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
  });

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  dataStore: "memory" | "postgres";
  databaseUrl?: string;
  authSecret: string;
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
    authSecret: parsed.data.AUTH_SECRET,
    corsOrigins: parsed.data.CORS_ORIGINS,
  };
}
