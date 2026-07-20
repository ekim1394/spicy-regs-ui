import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "agent",
    ],
    // React 19's compiler-oriented rules landed after most of this UI was
    // written. Keep the debt visible without making unrelated changes fail CI;
    // promote these warnings as the reported components are migrated.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      // DuckDB/Arrow boundary code is intentionally dynamic in several legacy
      // paths. New code should still prefer unknown plus explicit narrowing.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
