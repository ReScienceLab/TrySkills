import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import convexPlugin from "@convex-dev/eslint-plugin";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
  ]),
  // Convex best-practice rules for files in convex/
  {
    files: ["convex/**/*.ts"],
    plugins: {
      "@convex-dev": convexPlugin,
    },
    rules: {
      "@convex-dev/no-filter-in-query": "error",
      "@convex-dev/no-collect-in-query": "warn",
      "@convex-dev/require-args-validator": "error",
      "@convex-dev/explicit-table-ids": "error",
    },
  },
  // no-floating-promises for all TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
]);

export default eslintConfig;
