import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const unusedVariables = ["warn", {
  args: "after-used",
  argsIgnorePattern: "^_",
  caughtErrors: "none",
  varsIgnorePattern: "^_",
}];

const browserEvaluationScripts = [
  "scripts/check-timeline.mjs",
  "scripts/e2e-public-shell.mjs",
  "scripts/measure-route-bundles.mjs",
  "scripts/repro-auth-employee.mjs",
];

export default [
  {
    ignores: [
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".wrangler/**",
      ".wrangler-dry/**",
      ".upstream/**",
      "dist/**",
      "dist-frappe/**",
      "node_modules/**",
      "test-results/**",
      "vendor/**",
    ],
  },
  eslint.configs.recommended,
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-assignment": "warn",
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["legacy/typescript/**/*.ts"],
  })),
  {
    files: ["frontend/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals["shared-node-browser"],
        __: "readonly",
        EventListener: "readonly",
        FrameRequestCallback: "readonly",
      },
    },
    rules: {
      // The vendored frontend follows the upstream Frappe lint configuration.
      "no-unused-vars": "off",
      "no-useless-escape": "off",
      "no-unexpected-multiline": "off",
    },
  },
  {
    files: ["frontend/**/*.ts", "frontend/**/*.d.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ["app.js", "lib/**/*.js", "src/**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": unusedVariables,
    },
  },
  {
    files: ["legacy/typescript/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": unusedVariables,
    },
  },
  {
    files: ["worker/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.worker,
        ...globals.serviceworker,
      },
    },
    rules: {
      "no-unused-vars": unusedVariables,
    },
  },
  {
    files: ["api/**/*.js", "scripts/**/*.mjs", "playwright.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals["shared-node-browser"],
      },
    },
    rules: {
      "no-unused-vars": unusedVariables,
    },
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals["shared-node-browser"],
      },
    },
    rules: {
      "no-unused-vars": unusedVariables,
    },
  },
  {
    files: ["e2e/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals["shared-node-browser"],
      },
    },
    rules: {
      "no-unused-vars": unusedVariables,
    },
  },
  {
    files: browserEvaluationScripts,
    languageOptions: {
      globals: globals.browser,
    },
  },
];
