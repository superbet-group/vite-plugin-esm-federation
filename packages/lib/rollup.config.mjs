import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";

import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: "src/index.ts",
    plugins: [
      resolve(),
      commonjs(),
      typescript({ include: "./src/**/*.ts", module: "esnext" }),
    ],
    external: ["path", "vite", "rollup", "magic-string", "es-module-lexer"],
    output: [
      { format: "cjs", file: pkg.main, exports: "auto" },
      { format: "esm", file: pkg.module },
    ],
  },
];
