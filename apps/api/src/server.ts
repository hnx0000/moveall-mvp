import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AppStore } from "./domain/store.js";
import { MemoryStore } from "./infrastructure/memory-store.js";
import { PostgresStore } from "./infrastructure/postgres-store.js";

const config = loadConfig();

function createStore(): AppStore {
  if (config.dataStore === "postgres") {
    return new PostgresStore(config.databaseUrl!);
  }
  return new MemoryStore({ seedDemo: config.nodeEnv === "development" });
}

const app = await createApp({
  config,
  store: createStore(),
  logger: {
    level: config.nodeEnv === "production" ? "info" : "debug",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "res.headers.set-cookie",
      ],
      censor: "[REDACTED]",
    },
  },
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
