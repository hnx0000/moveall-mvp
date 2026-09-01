import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((file) => /\.(?:js|mjs|cjs|ts|tsx|json|md|ya?ml|ps1|sql)$/i.test(file))
  .filter((file) => !file.endsWith(".example") && file !== "scripts/check-secrets.mjs");

const secretPatterns = [
  { label: "JWT 형태의 비밀키", pattern: /\beyJ[A-Za-z0-9_-]{80,}\b/g },
  {
    label: "Supabase service-role 키",
    pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?(?!SET_|replace|example)[^\s"'#]{40,}/gi,
  },
  {
    label: "실제 PostgreSQL 연결 문자열",
    pattern: /postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']{8,}@[^\s/"']+\/[A-Za-z0-9_-]+/gi,
    safe: (value) => /PROJECT_REF|PASSWORD|localhost|change-me/i.test(value),
  },
  {
    label: "하드코딩된 AUTH_SECRET",
    pattern: /AUTH_SECRET\s*=\s*["']?(?!replace|generate|test-secret)[A-Za-z0-9+/=_-]{32,}/gi,
  },
];

const findings = [];
for (const file of files) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { label, pattern, safe } of secretPatterns) {
    pattern.lastIndex = 0;
    const matches = [...source.matchAll(pattern)];
    if (matches.some((match) => !safe?.(match[0]))) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error("커밋 대상에서 비밀값으로 의심되는 문자열을 발견했습니다:\n" + findings.join("\n"));
  process.exit(1);
}

console.info("Tracked and untracked source secret scan passed.");
