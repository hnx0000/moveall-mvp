import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/node_modules/**",
      "apps/mobile/expo-env.d.ts",
      "moveall-design-export/**",
      "artifacts/**",
      "output/**",
      "tmp/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        __DEV__: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "apps/mobile/test/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["site/**/*.mjs"],
    languageOptions: {
      globals: {
        Request: "readonly",
        URL: "readonly",
      },
    },
  },
);
