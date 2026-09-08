import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "prototypes/groov-korea-25d-map");
const destination = join(root, "apps/mobile/public/groov-maps");
// Ship browser runtime and geographic assets only. Never package the local .data store or server.
const excluded = new Set([
  "server.mjs",
  "course-api.mjs",
  "build-running-route.mjs",
  "fetch-dobong-boundaries.mjs",
]);
mkdirSync(destination, { recursive: true });
let count = 0;
for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (
    !entry.isFile() ||
    excluded.has(entry.name) ||
    entry.name.endsWith(".test.mjs") ||
    !/\.(html|css|js|mjs)$/.test(entry.name)
  )
    continue;
  cpSync(join(source, entry.name), join(destination, entry.name));
  count++;
}
cpSync(join(source, "assets"), join(destination, "assets"), { recursive: true });
console.log(
  `GROOV map runtime: ${count} modules + geographic assets → apps/mobile/public/groov-maps`,
);
