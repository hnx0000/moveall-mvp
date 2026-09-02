import { createDecipheriv, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import "dotenv/config";

if (process.env.RESTORE_CONFIRMATION !== "GROOV_RESTORE_TEST") {
  throw new Error("Set RESTORE_CONFIRMATION=GROOV_RESTORE_TEST for a dedicated test database.");
}
const sourcePath = resolve(required("BACKUP_FILE"));
const passphrase = required("BACKUP_ENCRYPTION_KEY");
const targetUrl = required("RESTORE_DATABASE_URL");
if (
  process.env.DATABASE_URL &&
  databaseIdentity(targetUrl) === databaseIdentity(process.env.DATABASE_URL)
)
  throw new Error("RESTORE_DATABASE_URL must not be DATABASE_URL.");
const pgConnection = new URL(targetUrl);
const pgPassword = decodeURIComponent(pgConnection.password);
pgConnection.password = "";
pgConnection.searchParams.set("sslmode", "verify-full");

const payload = readFileSync(sourcePath);
const magic = Buffer.from("GROOV-BACKUP-V1\n");
if (!payload.subarray(0, magic.length).equals(magic)) throw new Error("Unsupported backup format.");
const saltStart = magic.length;
const ivStart = saltStart + 16;
const tagStart = ivStart + 12;
const cipherStart = tagStart + 16;
const key = scryptSync(passphrase, payload.subarray(saltStart, ivStart), 32);
const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(ivStart, tagStart));
decipher.setAuthTag(payload.subarray(tagStart, cipherStart));
const restoredDump = Buffer.concat([
  decipher.update(payload.subarray(cipherStart)),
  decipher.final(),
]);
const temporaryPath = join(tmpdir(), `groov-restore-${randomUUID()}.dump`);

try {
  writeFileSync(temporaryPath, restoredDump, { mode: 0o600 });
  execFileSync(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      pgConnection.toString(),
      temporaryPath,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PGPASSWORD: pgPassword,
        ...(process.env.DATABASE_SSL_CA_FILE
          ? { PGSSLROOTCERT: process.env.DATABASE_SSL_CA_FILE }
          : {}),
      },
    },
  );
  const pool = new Pool({
    connectionString: targetUrl,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_SSL_CA_FILE
        ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8") }
        : {}),
    },
  });
  try {
    const check = await pool.query<{ migrations: number; sports: number }>(
      "SELECT (SELECT count(*)::int FROM schema_migrations) AS migrations, (SELECT count(*)::int FROM sports) AS sports",
    );
    console.log(JSON.stringify({ ok: true, ...check.rows[0] }));
  } finally {
    await pool.end();
  }
} finally {
  rmSync(temporaryPath, { force: true });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function databaseIdentity(value: string): string {
  const parsed = new URL(value);
  return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname}/${parsed.username}`;
}
