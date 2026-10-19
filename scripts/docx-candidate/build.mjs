import { fileURLToPath } from "node:url";
import { join } from "node:path";
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

/** Build the production adapter and its fixed sibling runtime assets in both formats. */
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

/** Use the shipping build configuration with every output rooted in the owned staging tree. */
export async function buildProductAssets(productRoot) {
  const { default: configurations } = await import("../../tsdown.config.ts");
  for (const configuration of configurations) {
    const format =
      configuration.format &&
      !Array.isArray(configuration.format) &&
      typeof configuration.format === "object"
        ? Object.fromEntries(
            Object.entries(configuration.format).map(([name, options]) => [
              name,
              {
                ...options,
                ...(options.outDir ? { outDir: join(productRoot, options.outDir) } : {}),
              },
            ]),
          )
        : configuration.format;
    await build({
      ...configuration,
      config: false,
      cwd: repo,
      ...(configuration.outDir ? { outDir: join(productRoot, configuration.outDir) } : {}),
      format,
    });
  }
}
