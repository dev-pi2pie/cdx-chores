import { defineConfig } from "tsdown";
import { docxRuntimeBuild } from "./scripts/build/docx-runtime.ts";

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
    target: "node22",
    fixedExtension: true,
    deps: {
      onlyBundle: ["picocolors"],
    },
  },
  {
    entry: {
      bin: "src/bin.ts",
    },
    format: ["esm"],
    dts: false,
    outDir: "dist/esm",
    clean: false,
    platform: "node",
    target: "node22",
    hash: false,
    fixedExtension: true,
    deps: {
      onlyBundle: ["picocolors"],
    },
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
    target: "node22",
    fixedExtension: true,
    deps: {
      onlyBundle: ["picocolors"],
    },
  },
  docxRuntimeBuild,
]);
