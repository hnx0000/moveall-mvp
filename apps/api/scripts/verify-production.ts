import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../db/migrations");
  const requiredMigrations = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const migrations = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY name",
  );
  const appliedMigrations = new Set(migrations.rows.map((row) => row.name));
  const missingMigrations = requiredMigrations.filter((name) => !appliedMigrations.has(name));
  const sports = await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM sports");
  const leagueLedger = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM league_workout_points",
  );
  const leagueIndexes = await pool.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'league_workout_points'",
  );
  const bucket = await pool.query<{ id: string; public: boolean }>(
    "SELECT id, public FROM storage.buckets WHERE id = $1",
    [process.env.SUPABASE_MEDIA_BUCKET ?? "groov-media"],
  );
  if (missingMigrations.length > 0) {
    throw new Error(`운영 DB에 적용되지 않은 마이그레이션: ${missingMigrations.join(", ")}`);
  }
  if (sports.rows[0]?.count !== 6) throw new Error("기본 운동 종목 수가 다릅니다.");
  const requiredLeagueIndexes = [
    "league_workout_points_pkey",
    "league_workout_points_region_range_idx",
    "league_workout_points_rank_idx",
    "league_workout_points_user_range_idx",
  ];
  const availableLeagueIndexes = new Set(leagueIndexes.rows.map((row) => row.indexname));
  const missingLeagueIndexes = requiredLeagueIndexes.filter(
    (name) => !availableLeagueIndexes.has(name),
  );
  if (missingLeagueIndexes.length > 0) {
    throw new Error(`지역 리그 인덱스가 없습니다: ${missingLeagueIndexes.join(", ")}`);
  }
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
      migrations: requiredMigrations.length,
      sports: sports.rows[0].count,
      leagueLedger: "ready",
      leagueRows: leagueLedger.rows[0]?.count ?? 0,
      leagueIndexes: requiredLeagueIndexes.length,
      mediaBucket: "private",
      signedUpload: "ready",
    }),
  );
} finally {
  await pool.end();
}
