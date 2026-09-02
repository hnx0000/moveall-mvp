import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { SupabaseMediaStorage } from "../src/infrastructure/media-storage.js";
import { PostgresStore } from "../src/infrastructure/postgres-store.js";

const requireStatus = (actual: number, expected: number, step: string): void => {
  if (actual !== expected) throw new Error(`${step} 실패: HTTP ${actual}`);
};

const config = loadConfig({
  ...process.env,
  NODE_ENV: "test",
  DEV_AUTH_BYPASS: "false",
  GOOGLE_CLIENT_IDS: "",
});
const sslCa = config.databaseSslCaFile
  ? await readFile(config.databaseSslCaFile, "utf8")
  : undefined;
const store = new PostgresStore(config.databaseUrl!, {
  maxConnections: 1,
  ssl: config.databaseSsl,
  ...(sslCa ? { sslCa } : {}),
});
const storage = new SupabaseMediaStorage(
  config.supabaseUrl!,
  config.supabaseServiceRoleKey!,
  config.supabaseMediaBucket,
);
const app = await createApp({ config, store, mediaStorage: storage });

const password = `Groov-${randomUUID()}-9`;
const email = `production-smoke-${randomUUID()}@example.invalid`;
let accessToken: string | undefined;
let runError: unknown;

try {
  const registration = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: { email, password, displayName: `smoke_${randomUUID().slice(0, 8)}` },
  });
  requireStatus(registration.statusCode, 201, "회원가입");
  accessToken = registration.json().data.accessToken as string;
  const authorization = { authorization: `Bearer ${accessToken}` };

  const sessions = await app.inject({
    method: "GET",
    url: "/v1/account/sessions",
    headers: authorization,
  });
  requireStatus(sessions.statusCode, 200, "세션 조회");

  const consent = await app.inject({
    method: "PUT",
    url: "/v1/consents/me",
    headers: authorization,
    payload: {
      termsVersion: "2026-09-02",
      privacyVersion: "2026-09-02",
      termsAccepted: true,
      privacyAccepted: true,
      healthDataAccepted: false,
      locationAccepted: false,
      mediaAccepted: true,
      marketingAccepted: false,
    },
  });
  requireStatus(consent.statusCode, 200, "동의 저장");

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/v1/media/upload-ticket",
    headers: authorization,
    payload: { kind: "post-image", contentType: "image/jpeg", byteSize: 4 },
  });
  requireStatus(ticketResponse.statusCode, 201, "업로드 URL 발급");
  const ticket = ticketResponse.json().data as {
    mediaId: string;
    signedUploadUrl: string;
  };
  const upload = await fetch(ticket.signedUploadUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    signal: AbortSignal.timeout(10_000),
  });
  if (!upload.ok) throw new Error(`미디어 업로드 실패: HTTP ${upload.status}`);

  const completed = await app.inject({
    method: "POST",
    url: `/v1/media/${ticket.mediaId}/complete`,
    headers: authorization,
  });
  requireStatus(completed.statusCode, 200, "미디어 완료 처리");

  const post = await app.inject({
    method: "POST",
    url: "/v1/posts",
    headers: authorization,
    payload: {
      sport: "running",
      content: "production smoke test",
      contentType: "post",
      mediaId: ticket.mediaId,
    },
  });
  requireStatus(post.statusCode, 201, "미디어 게시물 저장");
  if (!(post.json().data.mediaUrl as string | undefined)?.startsWith("https://")) {
    throw new Error("게시물 다운로드 URL 서명 실패");
  }
} catch (error) {
  runError = error;
}

let cleanupError: unknown;
if (accessToken) {
  try {
    const deletion = await app.inject({
      method: "DELETE",
      url: "/v1/account",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { confirmation: "GROOV 탈퇴", currentPassword: password },
    });
    requireStatus(deletion.statusCode, 200, "계정 완전 삭제");
    if (await store.findUserByEmail(email)) cleanupError = new Error("탈퇴 계정이 남아 있습니다.");
  } catch (error) {
    cleanupError = error;
  }
}
await app.close();

if (runError) throw runError;
if (cleanupError) throw cleanupError;

console.log(
  JSON.stringify({
    account: "ready",
    session: "ready",
    consent: "ready",
    mediaUpload: "ready",
    mediaPost: "ready",
    accountDeletion: "ready",
    mediaCleanup: "ready",
  }),
);
