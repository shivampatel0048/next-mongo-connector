// @ts-ignore
import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  entry: [
    "src/index.ts",
    "src/empty-module.ts"
  ],
  dts: true,
  shims: true,
  skipNodeModulesBundle: true,
  clean: true,
  minify: false,
  splitting: false,
  treeshake: true,
  sourcemap: false,
  target: "node16",
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".js" : ".mjs"
    };
  }
});
