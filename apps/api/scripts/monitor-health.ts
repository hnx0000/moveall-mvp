import "dotenv/config";

const configured = process.env.GROOV_API_HEALTH_URL?.trim();
if (!configured) throw new Error("GROOV_API_HEALTH_URL is required.");
const url = configured.endsWith("/ready") ? configured : `${configured.replace(/\/$/, "")}/ready`;
const startedAt = Date.now();
const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
const payload = (await response.json().catch(() => null)) as {
  ok?: boolean;
  data?: { status?: string; database?: string };
} | null;
if (!response.ok || !payload?.ok || payload.data?.status !== "ready") {
  throw new Error(`GROOV readiness check failed with HTTP ${response.status}.`);
}
console.log(
  JSON.stringify({
    ok: true,
    url,
    database: payload.data.database,
    latencyMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString(),
  }),
);
