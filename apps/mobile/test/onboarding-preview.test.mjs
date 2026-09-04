import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual screen callbacks without native modules, GPS or an account.
function screen(preview) {
  const values = [4, null, ["running"], "steady", ["consistency"], null, false, false, null];
  const calls = { complete: 0, location: 0, preferences: 0, redirects: [] };
  let index = 0;
  const element = (type, props) => ({ type, props });
  const modules = {
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    react: {
      useMemo: (fn) => fn(),
      useState: (initial) => {
        const key = index++;
        if (!(key in values)) values[key] = initial;
        return [
          values[key],
          (value) => {
            values[key] = typeof value === "function" ? value(values[key]) : value;
          },
        ];
      },
    },
    "react-native": {
      StyleSheet: { create: (styles) => styles },
      Pressable: "Pressable",
      View: "View",
      Text: "Text",
      ScrollView: "ScrollView",
      SafeAreaView: "SafeAreaView",
    },
    "@moveall/contracts": { sportLabels: {}, sportValues: [], usagePurposeOptions: [] },
    "expo-location": {
      requestForegroundPermissionsAsync: async () => {
        calls.location++;
        return { status: "denied" };
      },
    },
    "expo-router": { useRouter: () => ({ replace: (path) => calls.redirects.push(path) }) },
    "lucide-react-native": {},
    "../src/auth/auth-context": {
      useAuth: () => ({
        session: { user: { displayName: "기존 사용자" } },
        completeOnboarding: async () => {
          calls.complete++;
        },
      }),
    },
    "../src/neighborhood-preferences": {
      saveNeighborhoodPreferences: async () => {
        calls.preferences++;
      },
    },
    "../src/theme": { fonts: {} },
    "../src/theme-context": { useAppTheme: () => ({ colors: {} }) },
  };
  const code = ts.transpileModule(
    readFileSync(new URL("../app/onboarding.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const context = {
    exports: {},
    require: (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  };
  vm.runInNewContext(code, context);
  function render() {
    index = 0;
    return context.exports.OnboardingFlow({ preview });
  }
  return { render, calls, values };
}
function text(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join("");
  return node?.props ? text(node.props.children) : "";
}
function button(node, label) {
  if (!node) return null;
  if (Array.isArray(node)) return node.map((child) => button(child, label)).find(Boolean);
  if (node.type === "Pressable" && text(node) === label) return node;
  return button(node.props?.children, label);
}

test("preview location uses a sample without permissions or preference writes", () => {
  const app = screen(true);
  button(app.render(), "동네 인증 체험 (예시)").props.onPress();
  assert.equal(app.values[5].neighborhood, "미리보기 동네");
  assert.equal(app.calls.location, 0);
  assert.equal(app.calls.preferences, 0);
});
test("preview completion and restart never save or redirect", () => {
  const app = screen(true);
  button(app.render(), "동네 인증은 나중에").props.onPress();
  assert.equal(app.calls.complete, 0);
  assert.equal(app.calls.redirects.length, 0);
  assert.match(app.values[8], /저장되지 않았습니다/);
  button(app.render(), "처음부터").props.onPress();
  assert.equal(app.values[0], 0);
  assert.equal(app.values[2].length, 0);
  assert.equal(app.values[8], null);
});
test("normal onboarding still saves and returns to the app", async () => {
  const app = screen(false);
  assert.equal(button(app.render(), "처음부터"), undefined);
  button(app.render(), "동네 인증은 나중에").props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.calls.complete, 1);
  assert.deepEqual(app.calls.redirects, ["/"]);
});
