// One-time/repeatable web derivative generation. Original PNG artwork is never modified.
// Pass a local sharp module path when using an existing tool runtime instead of project dependencies.
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || "sharp");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const original = join(root, "apps/mobile/assets/images/medal-sculpted");
const output = join(root, "apps/mobile/assets/images/medal-sculpted-web");
await mkdir(output, { recursive: true });
const files = (await readdir(original)).filter(name => name.endsWith(".png")).sort();
if (files.length !== 106) throw Error("Expected 106 original medal images");
let before = 0, after = 0;
for (const name of files) {
  const input = join(original, name);
  const target = join(output, name.replace(/\.png$/, ".webp"));
  await sharp(input).webp({ quality: 94, effort: 5 }).toFile(target);
  const [sourceInfo, webInfo] = await Promise.all([sharp(input).metadata(), sharp(target).metadata()]);
  if (sourceInfo.width !== webInfo.width || sourceInfo.height !== webInfo.height) {
    throw Error("Unexpected image resize: " + name);
  }
  before += (await stat(input)).size;
  after += (await stat(target)).size;
}
const registry = join(root, "apps/mobile/src/rewards/medal-artwork-sources.ts");
const source = await readFile(registry, "utf8");
await writeFile(registry.replace(/\.ts$/, ".web.ts"), source
  .replaceAll("medal-sculpted/", "medal-sculpted-web/")
  .replaceAll(".png\"", ".webp\""));
console.log(JSON.stringify({ images: files.length, originalBytes: before, webBytes: after, dimensionsPreserved: true }));
