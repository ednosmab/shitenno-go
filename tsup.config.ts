import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/nexus.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
});
