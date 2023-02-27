import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: "src/index.ts",
    plugins: [resolve(), commonjs(), typescript(), json()],
    external: ["path", "vite", "rollup", "magic-string", "es-module-lexer"],
    output: [
      { format: "cjs", file: pkg.main, exports: "auto" },
      { format: "esm", file: pkg.module },
    ],
  },
];
