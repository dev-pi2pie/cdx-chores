import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    outDir: "dist/esm",
    dts: true,
    clean: true,
    platform: "node",
    target: "node20",
    fixedExtension: true,
    inlineOnly: ["picocolors"],
  },
  {
    entry: {
      bin: "src/bin.ts",
    },
    format: ["esm"],
    dts: false,
    outDir: "dist/esm",
    clean: false,
    sourcemap: true,
    platform: "node",
    target: "node20",
    hash: false,
    fixedExtension: true,
    inlineOnly: ["picocolors"],
    banner: "#!/usr/bin/env node\n",
  },
  {
    entry: {
      index: "src/index.cjs.ts",
    },
    format: ["cjs"],
    outDir: "dist/cjs",
    dts: false,
    clean: false,
    platform: "node",
    target: "node20",
    fixedExtension: true,
    inlineOnly: ["picocolors"],
  },
]);
