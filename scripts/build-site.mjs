import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { assertCompiledAppMode, siteBuildEnvironment } from "./site-build-policy.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg?.slice("--mode=".length) ?? "live";
const env = siteBuildEnvironment(mode, process.env);
const mobile = join(root, "apps", "mobile");
const mobileRequire = createRequire(join(mobile, "package.json"));
const expoCli = join(dirname(mobileRequire.resolve("expo/package.json")), "bin", "cli");
function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run([join(root, "scripts", "sync-map-runtime.mjs")], root);
// Do not reuse a transform cache created for another account/data mode.
// Calling Expo directly also prevents a package-manager shell from replacing build variables.
run([expoCli, "export", "--platform", "web", "--output-dir", "dist", "--clear"], mobile);

const mobileDist = join(root, "apps", "mobile", "dist");
if (!existsSync(join(mobileDist, "index.html"))) {
  throw new Error("모바일 웹 빌드 결과를 찾지 못했습니다.");
}
const bundleDirectory = join(mobileDist, "_expo", "static", "js", "web");
const entryBundles = readdirSync(bundleDirectory).filter((name) => /^entry-.*\.js$/.test(name));
if (entryBundles.length !== 1) throw new Error("Expected exactly one entry bundle");
assertCompiledAppMode(readFileSync(join(bundleDirectory, entryBundles[0]), "utf8"), mode);

const siteDist = join(root, "dist");
rmSync(siteDist, { recursive: true, force: true });
mkdirSync(join(siteDist, "client"), { recursive: true });
mkdirSync(join(siteDist, "server"), { recursive: true });
cpSync(mobileDist, join(siteDist, "client"), { recursive: true });
cpSync(join(root, "site", "worker.mjs"), join(siteDist, "server", "index.js"));
writeFileSync(
  join(siteDist, "client", "groov-build.json"),
  JSON.stringify({
    mode,
    entryBundle: entryBundles[0],
    builtAt: new Date().toISOString(),
  }) + "\n",
);
console.log(`Verified published app mode: ${mode}`);
