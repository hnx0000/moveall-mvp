import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { medalDefinitions as defs } from "../src/rewards/medal-design-catalog.ts";
const root = new URL("../", import.meta.url);

test("web archive uses 106 smaller WebP derivatives while retaining original PNGs", () => {
  const sources = readFileSync(new URL("src/rewards/medal-artwork-sources.web.ts", root), "utf8");
  let total = 0;
  const hashes = new Set();
  for (const d of defs) {
    const path = "assets/images/medal-sculpted-web/" + d.id + ".webp";
    assert.ok(sources.replace(/\s+/g, "").includes(d.id + ':require("../../' + path + '")'), d.id);
    const image = readFileSync(new URL(path, root));
    assert.equal(image.subarray(0, 4).toString(), "RIFF");
    assert.equal(image.subarray(8, 12).toString(), "WEBP");
    total += image.length;
    hashes.add(createHash("sha256").update(image).digest("hex"));
  }
  assert.equal(hashes.size, 106);
  assert.ok(total < 100 * 1024 * 1024, "medal web assets stay within hosting/mobile budget");
});
test("all 106 medals have their own complete, unique raster artwork", () => {
  const hashes = new Set();
  const sources = readFileSync(new URL("src/rewards/medal-artwork-sources.ts", root), "utf8");
  for (const d of defs) {
    const expected = "assets/images/medal-sculpted/" + d.id + ".png";
    assert.equal(d.assetPath, expected);
    assert.ok(existsSync(new URL(expected, root)), d.id);
    assert.ok(
      sources.replace(/\s+/g, "").includes(d.id + ':require("../../' + expected + '")'),
      d.id,
    );
    const image = readFileSync(new URL(expected, root));
    assert.equal(image.subarray(1, 4).toString(), "PNG", d.id);
    assert.equal(image.readUInt32BE(16), image.readUInt32BE(20), d.id + " square");
    assert.ok(image.readUInt32BE(16) >= 1024, d.id + " full resolution");
    hashes.add(createHash("sha256").update(image).digest("hex"));
  }
  assert.equal(hashes.size, 106, "no repeated material plates disguised as different medals");
});
test("special achievements have no ordinary grade or rank stage", () => {
  const special = defs.filter((d) => d.category === "special");
  assert.equal(special.length, 34);
  assert.ok(special.every((d) => d.grade === null && d.stage === null && d.assetPath));
});
test("archive uses completed artwork, not a material/logo/text composition", () => {
  const gallery = readFileSync(new URL("src/rewards/medal-sculpted-gallery.tsx", root), "utf8");
  const route = readFileSync(new URL("app/reward-collection.tsx", root), "utf8");
  assert.ok(route.includes("medal-sculpted-gallery"));
  assert.ok(!gallery.includes("SportLogo"));
  assert.ok(!gallery.includes("medal-materials"));
  assert.ok(!gallery.includes("engravingInk"));
  assert.ok(!gallery.includes("onLoadStart"), "no state-changing image load callback loop");
  assert.ok(!gallery.includes("imageState"));
  assert.ok(gallery.includes("medalArtworkSources[definition.id]"));
  assert.ok(gallery.includes('accessibilityLabel="이전 메달"'));
  assert.ok(gallery.includes('accessibilityLabel="다음 메달"'));
  assert.ok(gallery.includes('accessibilityLabel="잠금 상태 미리보기"'));
});
