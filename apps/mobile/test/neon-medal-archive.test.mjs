import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const catalogUrl = new URL("../src/rewards/neon-medal-catalog.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(catalogUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, require: (path) => path };
vm.runInNewContext(code, sandbox);
const {
  neonMedalDesigns: designs,
  neonMedalSources: sources,
  neonMedalSports: sports,
} = sandbox.exports;

test("neon archive holds exactly ten designs for each of the six sports", () => {
  assert.equal(designs.length, 60);
  assert.equal(new Set(designs.map((item) => item.id)).size, 60);
  assert.equal(sports.length, 6);
  for (const sport of sports) {
    assert.equal(designs.filter((item) => item.sport === sport.key).length, 10, sport.key);
  }
  assert.ok(designs.every((item) => item.title && item.name && item.metric));
});

test("all sixty separately generated artworks are bundled without duplicate files", () => {
  const hashes = new Set();
  let bytes = 0;
  for (const design of designs) {
    const expected = "../../assets/images/medal-neon-60/" + design.id.toLowerCase() + ".webp";
    assert.equal(sources[design.id], expected);
    const artwork = readFileSync(new URL(expected, catalogUrl));
    assert.equal(artwork.subarray(0, 4).toString(), "RIFF");
    assert.equal(artwork.subarray(8, 12).toString(), "WEBP");
    hashes.add(createHash("sha256").update(artwork).digest("hex"));
    bytes += artwork.length;
  }
  assert.equal(hashes.size, 60);
  assert.ok(bytes < 60 * 1024 * 1024, "archive display copies stay within a 60 MB budget");
});

test("new gallery stays inside the existing gated archive and preserves older collections", () => {
  const route = readFileSync(new URL("../app/reward-collection.tsx", import.meta.url), "utf8");
  const gallery = readFileSync(
    new URL("../src/rewards/neon-medal-gallery.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(route.includes("useDesignArchiveAccess"));
  assert.ok(route.indexOf("if (!allowed)") < route.indexOf("return <RewardCollectionContent"));
  assert.ok(route.includes("<NeonMedalGallery />"));
  assert.ok(route.includes("<MedalDesignGallery />"));
  assert.ok(route.includes("<ArchiveRewardTile"));
  assert.ok(gallery.includes('resizeMode="contain"'));
  assert.ok(gallery.includes("item.sport === sport"));
  assert.ok(gallery.includes('accessibilityLabel="네온 메달 상세 닫기"'));
  assert.ok(gallery.includes('accessibilityLabel="이전 네온 메달"'));
  assert.ok(gallery.includes('accessibilityLabel="다음 네온 메달"'));
  assert.ok(gallery.includes("실제 지급 조건이 아닙니다"));
  assert.ok(!gallery.includes('from "../api'));
});
