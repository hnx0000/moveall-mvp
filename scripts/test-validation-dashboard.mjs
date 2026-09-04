import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext, Script } from "node:vm";

const html = readFileSync(new URL("../GROOV_dev_dashboard.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../docs/PRODUCT_VALIDATION.md", import.meta.url), "utf8");
const js = readFileSync(new URL("../dashboard/validation-ui.js", import.meta.url), "utf8");
const context = createContext({});
runInContext(js, context);
const model = context.GroovValidation;
const decode = (text) =>
  text
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
const markup = html.match(
  /<!-- product-validation:start -->([\s\S]*?)<!-- product-validation:end -->/,
)[1];
const cards = [...markup.matchAll(/<details class="validation-card"[^>]*>([\s\S]*?)<\/details>/g)]
  .map((match) => match[1])
  .filter((card) => card.includes('class="validation-list"'));
const ids = ["record", "social", "competition", "achievement", "common"];
const groups = cards.map((card, index) => ({
  id: ids[index],
  items: [
    ...card.matchAll(
      /<li><span[^>]*class="validation-mark"[^>]*>([^<]*)<\/span><span>([\s\S]*?)<\/span><\/li>/g,
    ),
  ].map(([, mark, raw]) => {
    const content = decode(raw);
    return { id: model.itemKey(ids[index], content), content, baseline: mark === "✓" };
  }),
}));
const fresh = () => model.normalize(null, groups);
const storage = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

test("dashboard keeps all 25 original criteria and separate, non-overlapping item keys", () => {
  assert.equal(groups.length, 5);
  assert.ok(groups.every((group) => group.items.length === 5));
  const expected = [...source.matchAll(/^- \[[ xX]\] (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.content)),
    expected,
  );
  assert.equal(new Set(groups.flatMap((group) => group.items.map((item) => item.id))).size, 25);
});

test("all scripts compile and the UI extension remains outside generated markup", () => {
  new Script(js);
  for (const [, code] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Script(code);
  assert.ok(html.includes('<style id="validation-ui-styles">'));
  assert.ok(
    html.indexOf('id="validation-ui-script"') >
      html.indexOf("<!-- product-validation:end -->"),
  );
  assert.ok(html.includes("groov-dashboard-todos-v5"));
  assert.notEqual(model.STORAGE_KEY, "groov-dashboard-todos-v5");
  const embedded = html.match(/<script id="validation-ui-script">([\s\S]*?)<\/script>/)[1];
  assert.equal(embedded.replaceAll("\r\n", "\n").trim(), js.replaceAll("\r\n", "\n").trim());
  assert.ok(!js.includes("innerHTML"), "free text is rendered as text/value, never injected HTML");
});

test("fresh state never invents a verified persona", () => {
  const state = fresh();
  assert.equal(model.totals(state, groups).verified, 0);
  assert.equal(model.totals(state, groups).checked, 0);
  assert.equal(model.totals(state, groups).total, 25);
});

test("checks alone do not verify; evidence and an explicit decision are required", () => {
  const state = fresh();
  const group = groups[0];
  assert.ok(model.setReview(state, group, "status", "verified"));
  group.items.forEach((item) => model.setCheck(state, group, item.id, true));
  assert.equal(state.reviews.record.status, "unverified");
  assert.ok(model.setReview(state, group, "status", "verified"));
  model.setReview(state, group, "evidence", "익명 참여자 A · 저장/회고 성공 · 개선점 인터뷰");
  assert.equal(model.setReview(state, group, "status", "verified"), "");
  assert.equal(model.totals(state, groups).verified, 1);
  assert.equal(model.totals(state, groups).common, 0);
});

test("unchecking or changing validation evidence invalidates the old verified decision", () => {
  const state = fresh();
  const group = groups[1];
  group.items.forEach((item) => model.setCheck(state, group, item.id, true));
  model.setReview(state, group, "evidence", "실제 상대와 공유·반응 관찰 완료");
  model.setReview(state, group, "status", "verified");
  assert.ok(model.setCheck(state, group, group.items[0].id, false));
  assert.equal(state.reviews.social.status, "unverified");
  model.setCheck(state, group, group.items[0].id, true);
  model.setReview(state, group, "status", "verified");
  assert.ok(model.setReview(state, group, "round", "새 검증 라운드"));
  assert.equal(state.reviews.social.status, "unverified");
});

test("hold requires a reason; improve remains separate from completed validation", () => {
  const state = fresh();
  const group = groups[2];
  assert.ok(model.setReview(state, group, "status", "hold"));
  model.setReview(state, group, "evidence", "참여자를 모집한 뒤 확인 필요");
  model.setReview(state, group, "status", "hold");
  assert.equal(state.reviews.competition.status, "hold");
  model.setReview(state, group, "status", "improve");
  assert.equal(model.totals(state, groups).verified, 0);
});

test("reload preserves checkbox/notes, isolates personas and never changes development checks", () => {
  const store = storage();
  store.setItem("groov-dashboard-todos-v5", '{"0":true,"1":false}');
  const state = fresh();
  const group = groups[3];
  model.setCheck(state, group, group.items[0].id, true);
  model.setReview(state, group, "evidence", '<script>alert("not executable")</script>');
  state.feature.name = "기록 전용 사용성 개선";
  assert.equal(model.save(store, state), true);
  const restored = model.load(store, groups);
  assert.equal(restored.error, "");
  assert.equal(restored.state.checks[group.items[0].id], true);
  assert.equal(restored.state.reviews.achievement.evidence, state.reviews.achievement.evidence);
  assert.equal(restored.state.feature.name, state.feature.name);
  assert.equal(restored.state.reviews.record.evidence, "");
  assert.equal(store.getItem("groov-dashboard-todos-v5"), '{"0":true,"1":false}');
});

test("corrupt or blocked storage fails safely without pretending changes were saved", () => {
  const store = storage();
  store.setItem(model.STORAGE_KEY, "not-json");
  assert.ok(model.load(store, groups).error);
  assert.equal(model.totals(model.load(store, groups).state, groups).verified, 0);
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.ok(model.load(blocked, groups).error);
  assert.equal(model.save(blocked, fresh()), false);
});

test("unknown or stale saved data cannot falsely validate changed criteria", () => {
  const state = fresh();
  state.checks.unknown = true;
  state.reviews.record.status = "verified";
  const clean = model.normalize(state, groups);
  assert.equal(clean.reviews.record.status, "unverified");
  assert.equal(Object.hasOwn(clean.checks, "unknown"), false);
  assert.notEqual(model.itemKey("record", "이전 기준"), model.itemKey("record", "변경된 기준"));
  assert.equal(model.normalize({ schemaVersion: 99 }, groups).reviews.record.status, "unverified");
});
