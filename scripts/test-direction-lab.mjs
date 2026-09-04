import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext, Script } from "node:vm";
import test from "node:test";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const js = read("../dashboard/direction-model.js");
const ui = read("../dashboard/direction-lab.js");
const html = read("../dashboard/direction-lab.html");
const context = createContext({});
runInContext(js, context);
const M = context.GroovDirection;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("the example is explicitly preview data with correct denominators", () => {
  const data = M.example();
  assert.equal(data.source, "preview");
  assert.equal(data.respondents, 100);
  assert.equal(data.totalUsers, 125);
  assert.equal(data.responseRatePercent, 80);
  assert.equal(data.skipped, 15);
  assert.equal(data.uncollected, 10);
  assert.equal(data.excludedUsers, 3);
  assert.deepEqual(plain(data.distribution.map((row) => row.percent)), [42, 31, 8, 19]);
});

test("import recomputes percentages and strips personal/unrelated properties", () => {
  const raw = plain(M.example());
  raw.source = "registered_users";
  raw.email = "must-not-appear@example.test";
  raw.distribution[0].percent = 999;
  raw.responseRatePercent = 999;
  const result = M.normalizeSummary(raw);
  assert.equal(result.distribution[0].percent, 42);
  assert.equal(result.responseRatePercent, 80);
  assert.equal(Object.hasOwn(result, "email"), false);
  assert.equal(result.source, "registered_users");
});

test("invalid, duplicate, negative and inconsistent counts are rejected", () => {
  for (const mutate of [
    (x) => {
      x.distribution[0].count = -1;
    },
    (x) => {
      x.distribution[0].count = 0.5;
    },
    (x) => {
      x.distribution[1].purpose = "record";
    },
    (x) => {
      x.totalUsers += 1;
    },
    (x) => {
      x.respondents += 1;
    },
    (x) => {
      x.distribution.pop();
    },
    (x) => {
      x.source = "example-as-production";
    },
  ]) {
    const raw = plain(M.example());
    mutate(raw);
    assert.throws(() => M.normalizeSummary(raw));
  }
});

test("question version and cohort cannot be silently mixed", () => {
  const raw = plain(M.example());
  raw.questionVersion = 2;
  assert.throws(() => M.normalizeSummary(raw), /질문 v1/);
  raw.questionVersion = 1;
  raw.cohort = { registeredFrom: "2026-09-03T00:00:00Z", registeredBefore: "2026-09-01T00:00:00Z" };
  assert.throws(() => M.normalizeSummary(raw), /가입 기간/);
  raw.cohort = { registeredFrom: "bad-date" };
  assert.throws(() => M.normalizeSummary(raw));
});

test("no answers never becomes zero satisfaction or an invented ranking", () => {
  const data = M.fromCounts({ record: 0, social: 0, competition: 0, achievement: 0 }, 4, 6);
  assert.equal(data.respondents, 0);
  assert.ok(data.distribution.every((row) => row.percent === null));
  assert.ok(M.rank(data, M.defaultReviews(true)).every((row) => row.score === null));
  assert.ok(M.warnings(data, "imported").some((text) => text.includes("응답이 없습니다")));
});

test("candidate overlap is handled within each candidate, not as investment shares", () => {
  const rows = M.rank(M.example(), M.defaultReviews(true));
  const growth = rows.find((row) => row.id === "growth");
  assert.equal(growth.count, 61);
  assert.equal(growth.share, 61);
  assert.equal(growth.score, 22.2);
  assert.equal(rows[0].id, "record-flow");
  assert.equal(rows[0].score, 56.8);
});

test("minority needs can rank above majority demand without excluding anyone", () => {
  const rows = M.rank(M.example(), M.defaultReviews(true));
  const competition = rows.find((row) => row.id === "fair-play");
  const growth = rows.find((row) => row.id === "growth");
  assert.equal(competition.share, 8);
  assert.ok(competition.score > growth.score);
  assert.equal(rows.length, 5);
});

test("imported data starts with no assumed observation or urgency", () => {
  const reviews = M.defaultReviews(false);
  assert.ok(
    Object.values(reviews).every((review) => review.evidence === "" && review.severity === null),
  );
  assert.ok(M.rank(M.example(), reviews).every((row) => row.score === null));
});

test("blank evidence, invalid severity and effort never receive a score", () => {
  const reviews = M.defaultReviews(true);
  reviews.sharing.evidence = " ";
  reviews.growth.effort = 0;
  reviews.milestone.severity = 4;
  const rows = M.rank(M.example(), reviews);
  for (const id of ["sharing", "growth", "milestone"])
    assert.equal(rows.find((row) => row.id === id).score, null);
});

test("low sample and nonresponse warnings stay explicit and do not claim significance", () => {
  const data = M.fromCounts({ record: 4, social: 2, competition: 1, achievement: 1 }, 4, 18);
  const warnings = M.warnings(data, "manual").join(" ");
  assert.match(warnings, /직접 입력한 가정/);
  assert.match(warnings, /통계적 보장 기준이 아닙니다/);
  assert.match(warnings, /미응답자의 목적은 알 수 없습니다/);
});

const decision = () => ({
  summary: M.example(),
  mode: "example",
  reviews: M.defaultReviews(true),
  candidateId: "record-flow",
  reason: "[예시] 비중과 반복 불편을 함께 확인",
  success: "저장 후 지난 기록 찾기 성공률 전후 비교",
  nextDate: "2026-09-10",
  critical: false,
  criticalEvidence: "",
});
test("decision snapshot records provenance, evidence, formula and denominators", () => {
  const entry = M.makeDecision(decision());
  assert.equal(entry.mode, "example");
  assert.equal(entry.summary.respondents, 100);
  assert.equal(entry.summary.totalUsers, 125);
  assert.equal(entry.score, 56.8);
  assert.equal(entry.formulaVersion, "exploration-v1");
  assert.match(entry.evidence, /예시/);
  const args = decision();
  const saved = M.makeDecision(args);
  args.summary.distribution[0].count = 0;
  assert.equal(saved.summary.distribution[0].count, 42);
});

test("serious safety failures stop candidate decisions regardless of score", () => {
  assert.throws(() => M.makeDecision({ ...decision(), critical: true }), /근거/);
  assert.throws(
    () => M.makeDecision({ ...decision(), critical: true, criticalEvidence: "기록 유실 재현" }),
    /복구/,
  );
});

test("incomplete decisions and invalid dates are rejected", () => {
  assert.throws(() => M.makeDecision({ ...decision(), reason: " " }));
  assert.throws(() => M.makeDecision({ ...decision(), nextDate: "2026-02-30" }));
  assert.throws(() => M.makeDecision({ ...decision(), candidateId: "unknown" }));
  assert.throws(() => M.makeDecision({ ...decision(), mode: "verified-production" }));
});

test("standalone prototype parses, has its local assets and no API writes", () => {
  new Script(js);
  new Script(ui);
  for (const [, file] of html.matchAll(/(?:src|href)="(direction-[^"]+)"/g))
    assert.ok(existsSync(new URL(`../dashboard/${file}`, import.meta.url)));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of ui.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(id), id);
  assert.doesNotMatch(ui, /innerHTML|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(ui, /groov-direction-lab-decisions-v1/);
  assert.doesNotMatch(ui, /groov-dashboard-todos-v5|groov-dashboard-user-validation-v1/);
  assert.match(html, /검토용 시안 · 앱 미연동/);
});
