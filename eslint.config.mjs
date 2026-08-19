import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/public-competition-live-v2.tsx"],
    // This view intentionally starts request-state hydration when the active
    // public tab changes. The async loaders own that transient loading state.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: ["app/snooker/data-ops/data-ops-client.tsx"],
    // The protected Data Ops console hydrates its private database snapshot
    // only after the server-side admin session has been resolved.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
