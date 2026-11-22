import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/",
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "pnpm-lock.yaml",
      "next-env.d.ts",
      "reference/",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
];

export default eslintConfig;
