// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // TypeScript's own compiler (with @types/node in scope) already
      // catches undefined names more accurately than eslint's no-undef,
      // which doesn't understand TS types/ambient declarations.
      "no-undef": "off",
    },
  },
);
