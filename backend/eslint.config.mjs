import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
          allowDefaultProject: [
            "src/modules/*.spec.ts",
            "src/modules/*/*.spec.ts",
            "src/shared/*/*.spec.ts",
            "test/*.spec.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "generated/**", "src/generated/**"],
  },
);
