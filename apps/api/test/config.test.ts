import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const secureSecret = "a-production-secret-with-more-than-32-characters";

describe("environment configuration", () => {
  it("rejects an in-memory production data store", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATA_STORE: "memory",
        AUTH_SECRET: secureSecret,
      }),
    ).toThrow("production 환경에서는 DATA_STORE=postgres가 필요합니다.");
  });

  it("accepts a PostgreSQL production configuration", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      DATA_STORE: "postgres",
      DATABASE_URL: "postgresql://moveall:password@localhost:5432/moveall",
      AUTH_SECRET: secureSecret,
    });

    expect(config.dataStore).toBe("postgres");
  });
});
