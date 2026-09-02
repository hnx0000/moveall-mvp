import "dotenv/config";
import { readFileSync } from "node:fs";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AppStore } from "./domain/store.js";
import { MemoryStore } from "./infrastructure/memory-store.js";
import { DisabledMediaStorage, SupabaseMediaStorage } from "./infrastructure/media-storage.js";
import { PostgresStore } from "./infrastructure/postgres-store.js";
import { ExpoPushSender } from "./infrastructure/push-sender.js";

const config = loadConfig();

function createStore(): AppStore {
  if (config.dataStore === "postgres") {
    return new PostgresStore(config.databaseUrl!, {
      maxConnections: config.databaseMaxConnections,
      ssl: config.databaseSsl,
      ...(config.databaseSslCaFile
        ? { sslCa: readFileSync(config.databaseSslCaFile, "utf8") }
        : {}),
    });
  }
  return new MemoryStore({ seedDemo: config.nodeEnv === "development" });
}

const app = await createApp({
  config,
  store: createStore(),
  mediaStorage:
    config.mediaStorage === "supabase"
      ? new SupabaseMediaStorage(
          config.supabaseUrl!,
          config.supabaseServiceRoleKey!,
          config.supabaseMediaBucket,
        )
      : new DisabledMediaStorage(),
  pushSender: new ExpoPushSender(config.expoPushAccessToken),
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
