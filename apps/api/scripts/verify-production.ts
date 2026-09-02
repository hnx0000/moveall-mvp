import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { SupabaseMediaStorage } from "../src/infrastructure/media-storage.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name}이 필요합니다.`);
  return value;
};

const sslCa = process.env.DATABASE_SSL_CA_FILE
  ? await readFile(process.env.DATABASE_SSL_CA_FILE, "utf8")
  : undefined;

const pool = new Pool({
  connectionString: required("DATABASE_URL"),
  ssl:
    process.env.DATABASE_SSL === "disable"
      ? false
      : { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) },
  max: 1,
  application_name: "groov-production-verification",
});

try {
  const migrations = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM schema_migrations",
  );
  const sports = await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM sports");
  const bucket = await pool.query<{ id: string; public: boolean }>(
    "SELECT id, public FROM storage.buckets WHERE id = $1",
    [process.env.SUPABASE_MEDIA_BUCKET ?? "groov-media"],
  );
  if (migrations.rows[0]?.count !== 10) throw new Error("운영 DB 마이그레이션 수가 다릅니다.");
  if (sports.rows[0]?.count !== 6) throw new Error("기본 운동 종목 수가 다릅니다.");
  if (!bucket.rows[0] || bucket.rows[0].public) throw new Error("비공개 미디어 버킷이 없습니다.");

  const storage = new SupabaseMediaStorage(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    process.env.SUPABASE_MEDIA_BUCKET ?? "groov-media",
  );
  const ticket = await storage.createUploadTicket({
    userId: "00000000-0000-4000-8000-000000000000",
    kind: "post-image",
    contentType: "image/jpeg",
  });
  if (!ticket.signedUploadUrl.startsWith("https://")) {
    throw new Error("서명된 업로드 URL이 생성되지 않았습니다.");
  }

  console.log(
    JSON.stringify({
      database: "connected",
      migrations: migrations.rows[0].count,
      sports: sports.rows[0].count,
      mediaBucket: "private",
      signedUpload: "ready",
    }),
  );
} finally {
  await pool.end();
}
