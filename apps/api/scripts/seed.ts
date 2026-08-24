import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL이 필요합니다.");

const pool = new Pool({ connectionString: databaseUrl });
try {
  const seedPath = join(dirname(fileURLToPath(import.meta.url)), "../db/seed.sql");
  await pool.query(await readFile(seedPath, "utf8"));
  console.info("Seed completed");
} finally {
  await pool.end();
}
