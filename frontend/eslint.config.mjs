import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDirectory });

const eslintConfig = [
  {
    ignores: [".next/**", ".next-*/**", "node_modules/**", "coverage/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // This project uses the App Router root layout, so pages/_document does not exist.
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default eslintConfig;
