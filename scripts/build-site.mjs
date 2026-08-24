import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("pnpm 실행 경로를 찾지 못했습니다.");

const build = spawnSync(process.execPath, [pnpmCli, "--filter", "@moveall/mobile", "build"], {
  cwd: root,
  env: { ...process.env, EXPO_PUBLIC_DEMO_MODE: "true" },
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const mobileDist = join(root, "apps", "mobile", "dist");
if (!existsSync(join(mobileDist, "index.html"))) {
  throw new Error("모바일 웹 빌드 결과를 찾지 못했습니다.");
}

const siteDist = join(root, "dist");
rmSync(siteDist, { recursive: true, force: true });
mkdirSync(join(siteDist, "client"), { recursive: true });
mkdirSync(join(siteDist, "server"), { recursive: true });
cpSync(mobileDist, join(siteDist, "client"), { recursive: true });
cpSync(join(root, "site", "worker.mjs"), join(siteDist, "server", "index.js"));
