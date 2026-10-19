import type { UserConfig } from "tsdown";

/**
 * Internal DOCX runtime assets shipped with the package.
 * Output names must match src/docx/runtime/assets.ts.
 */
export const docxRuntimeBuild = {
  entry: {
    "docx-child": "src/docx/runtime/docx-child.ts",
    "docx-worker": "src/docx/runtime/docx-worker.ts",
    "docx-parser": "src/docx/reader.ts",
  },
  format: {
    esm: { outDir: "dist/esm" },
    cjs: { outDir: "dist/cjs" },
  },
  dts: false,
  clean: false,
  platform: "node",
  target: "node22",
  fixedExtension: true,
  deps: {
    onlyBundle: [],
  },
} satisfies UserConfig;
