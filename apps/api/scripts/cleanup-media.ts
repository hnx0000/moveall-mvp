import { Pool } from "pg";
import { readFileSync } from "node:fs";
import "dotenv/config";
import { SupabaseMediaStorage } from "../src/infrastructure/media-storage.js";

const databaseUrl = required("DATABASE_URL");
const storage = new SupabaseMediaStorage(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  process.env.SUPABASE_MEDIA_BUCKET?.trim() || "groov-media",
);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_SSL_CA_FILE
      ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8") }
      : {}),
  },
});

try {
  const result = await pool.query<{ id: string; object_path: string }>(
    `SELECT mo.id, mo.object_path
       FROM media_objects mo
       LEFT JOIN posts p ON p.media_id = mo.id
      WHERE mo.status IN ('pending', 'available')
        AND mo.created_at < now() - interval '24 hours'
        AND (
          mo.status = 'pending'
          OR (mo.kind IN ('post-image', 'story-image', 'story-video') AND p.id IS NULL)
        )
      ORDER BY mo.created_at ASC
      LIMIT 500`,
  );
  let removed = 0;
  for (const item of result.rows) {
    await storage.removeObject(item.object_path);
    await pool.query(
      "UPDATE media_objects SET status = 'deleted', deleted_at = now() WHERE id = $1",
      [item.id],
    );
    removed += 1;
  }
  console.log(JSON.stringify({ ok: true, removed, checked: result.rowCount ?? 0 }));
} finally {
  await pool.end();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
