// Archive display copies only. Generated PNG masters in docs stay untouched.
import { createRequire } from "node:module";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || "sharp");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const archive = join(root, "docs/medal-design-archive/sport-neon-60");
const { assets } = JSON.parse(await readFile(join(archive, "generated-manifest.json"), "utf8"));
if (assets.length !== 60 || new Set(assets.map((asset) => asset.id)).size !== 60) {
  throw new Error("Expected 60 unique neon medal originals");
}
const output = join(root, "apps/mobile/assets/images/medal-neon-60");
await mkdir(output, { recursive: true });
let bytes = 0;
for (const asset of assets) {
  const source = join(archive, asset.file);
  const target = join(output, asset.id.toLowerCase() + ".webp");
  await sharp(source).webp({ quality: 94, effort: 5 }).toFile(target);
  const [original, copy] = await Promise.all([sharp(source).metadata(), sharp(target).metadata()]);
  if (original.width !== copy.width || original.height !== copy.height) {
    throw new Error("Unexpected resize: " + asset.id);
  }
  bytes += (await stat(target)).size;
}
console.log(JSON.stringify({ images: assets.length, bytes, dimensionsPreserved: true }));
