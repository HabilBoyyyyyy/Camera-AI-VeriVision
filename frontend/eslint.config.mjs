import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This rule flags the common "sync local state from a prop/poll result
      // inside useEffect" pattern used deliberately across the live camera,
      // training monitor, and dataset/label editors. It doesn't affect the
      // production build and none of the flagged spots are actual bugs, so
      // it's kept visible as a warning instead of failing lint outright.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
