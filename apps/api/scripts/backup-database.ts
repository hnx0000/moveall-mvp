import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import "dotenv/config";

const databaseUrl = required("DATABASE_URL");
const pgConnection = new URL(databaseUrl);
const pgPassword = decodeURIComponent(pgConnection.password);
pgConnection.password = "";
pgConnection.searchParams.set("sslmode", "verify-full");
const passphrase = required("BACKUP_ENCRYPTION_KEY");
if (passphrase.length < 32)
  throw new Error("BACKUP_ENCRYPTION_KEY must be at least 32 characters.");

const outputDirectory = resolve(process.env.BACKUP_OUTPUT_DIR ?? "backups");
mkdirSync(outputDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const plainPath = join(outputDirectory, `groov-${timestamp}.dump`);
const encryptedPath = `${plainPath}.enc`;

try {
  execFileSync(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      plainPath,
      pgConnection.toString(),
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
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(readFileSync(plainPath)), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  writeFileSync(
    encryptedPath,
    Buffer.concat([Buffer.from("GROOV-BACKUP-V1\n"), salt, iv, authenticationTag, encrypted]),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ ok: true, backup: basename(encryptedPath), encrypted: true }));
} finally {
  rmSync(plainPath, { force: true });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
