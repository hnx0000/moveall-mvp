import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync(new URL("../app/league-map-preview.tsx", import.meta.url), "utf8");

test("league map preview exposes five structurally distinct concepts", () => {
  for (const code of ["FOCUS", "INDEX", "SPLIT", "TOP 5", "LENS"]) {
    assert.match(preview, new RegExp(code.replace(" ", "\\s")));
  }
  assert.match(preview, /option === 1/);
  assert.match(preview, /option === 5/);
});

test("preview map supports tap selection and double-tap focus", () => {
  assert.match(preview, /function handleAreaPress/);
  assert.match(preview, /now - lastTap\.current\.at < 360/);
  assert.match(preview, /setSelectedCode\(area\.code\)/);
  assert.match(preview, /focusViewport\(area\.center, 7\.4\)/);
});

test("map label density changes by concept", () => {
  assert.match(preview, /if \(option === 1 \|\| option === 3\) return null/);
  assert.match(preview, /option === 2/);
  assert.match(preview, /option === 4 \? topFive/);
  assert.match(preview, /\[selected, \.\.\.nearest\]/);
});
