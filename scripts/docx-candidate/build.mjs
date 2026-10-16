import { fileURLToPath } from "node:url";
import { build } from "tsdown";

const repo = fileURLToPath(new URL("../../", import.meta.url));

/** One private build policy shared by comparisons, measurements, and packaging. */
export function candidateBuildOptions(outDir) {
  return {
    config: false,
    cwd: repo,
    outDir,
    platform: "node",
    target: "node22",
    fixedExtension: true,
    dts: false,
    clean: false,
    logLevel: "silent",
    deps: { onlyBundle: [] },
  };
}

/** Build the actual candidate and its fixed sibling runtime assets in both formats. */
export async function buildCandidateAssets(outDir) {
  await build({
    ...candidateBuildOptions(outDir),
    entry: {
      reader: "scripts/docx-candidate/adapter.ts",
      "docx-child": "src/docx/runtime/docx-child.ts",
      "docx-worker": "src/docx/runtime/docx-worker.ts",
      "docx-parser": "src/docx/reader.ts",
    },
    format: ["esm", "cjs"],
  });
}
