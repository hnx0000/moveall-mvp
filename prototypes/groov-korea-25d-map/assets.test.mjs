import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const assetRoot = new URL("./assets/", import.meta.url);
const mapImages = ["korea.png", "seoul.png", "gyeonggi.png", "gangwon.png", "chungcheong.png", "jeolla.png", "gyeongsang.png", "jeju.png"];
const sourceImages = Array.from({ length: 12 }, (_, index) => `source-${index + 1}.jpg`);

test("all 20 map-production images are packaged and non-empty", async () => {
  const sizes = await Promise.all([...mapImages, ...sourceImages].map(async (name) => (await stat(new URL(name, assetRoot))).size));
  assert.equal(sizes.length, 20);
  assert.ok(sizes.every((size) => size > 40_000));
});

test("the geographic base contains 250 municipalities across 17 province codes", async () => {
  const topology = JSON.parse(await readFile(new URL("korea-municipalities.json", assetRoot), "utf8"));
  const geometries = topology.objects.skorea_municipalities_2018_geo.geometries;
  const provinceCodes = new Set(geometries.map((geometry) => String(geometry.properties.code).slice(0, 2)));
  assert.equal(geometries.length, 250);
  assert.equal(provinceCodes.size, 17);
});
