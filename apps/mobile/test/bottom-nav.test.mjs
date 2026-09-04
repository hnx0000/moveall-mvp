import assert from "node:assert/strict";
import test from "node:test";
import { bottomNavItems, bottomNavPalette } from "../src/components/bottom-nav-model.ts";
import { NAV_ICONS } from "../../../prototypes/tab-lab/nav-icons.mjs";

test("approved navigation labels preserve route order", () => {
  assert.deepEqual(Object.keys(bottomNavItems), [
    "index",
    "community",
    "routines",
    "knowledge",
    "profile",
  ]);
  assert.deepEqual(
    Object.values(bottomNavItems).map((item) => item.label),
    ["홈", "TODAY", "기록·콘텐츠 추가", "리그", "MY"],
  );
});
test("all five icons exactly match the approved preview", () => {
  ["home", "sun", "plus", "trophy", "user"].forEach((icon, index) =>
    assert.equal(Object.values(bottomNavItems)[index].path, NAV_ICONS[icon]),
  );
  assert.equal(bottomNavPalette.active, "#FF613B");
});
