// Flat config, resolved upward from each package's cwd by ESLint 9.
// Non-type-aware on purpose: fast, and needs no build ordering in turbo.
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/src-tauri/target/**",
      "**/src-tauri/gen/**",
      "**/*.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/overlay/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    rules: {
      // The codebase deliberately parses untrusted JSON (AI output, GGG API)
      // into loose shapes at boundaries; warn instead of churning working code.
      "@typescript-eslint/no-explicit-any": "warn",
      // Empty catch is idiomatic in the try-parse-else-repair chains (parseAiJson).
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier
);
