import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const todaySource = read("../app/(tabs)/community.tsx");

function renderToday(params = {}) {
  const modules = {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "expo-router": { Redirect: "Redirect", useLocalSearchParams: () => params },
    "../../src/screens/exercise-bible-screen": { ExerciseBibleScreen: "ExerciseBibleScreen" },
  };
  const code = ts.transpileModule(todaySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = {
    exports: {},
    require: (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  };
  vm.runInNewContext(code, context);
  return context.exports.default();
}

test("TODAY opens the exercise Bible instead of the placeholder", () => {
  assert.equal(renderToday().type, "ExerciseBibleScreen");
});

test("old feed links still redirect to Home with their parameters", () => {
  for (const key of ["post", "workoutSessionId", "photo", "draft"]) {
    const params = { [key]: "test-id", comments: "1" };
    const result = renderToday(params);
    assert.equal(result.type, "Redirect");
    assert.equal(result.props.href.pathname, "/");
    assert.equal(result.props.href.params, params);
  }
});

test("League no longer renders or loads the exercise Bible", () => {
  const league = read("../app/(tabs)/knowledge.tsx");
  assert.doesNotMatch(league, /운동 바이블|ExerciseBibleScreen|api\.knowledge/);
  assert.match(league, /SEASON MATCH/);
});
