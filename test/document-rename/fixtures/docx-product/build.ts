import { rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { build } from "tsdown";

import { startFixtureProcess } from "../../../../scripts/testing/fixtures/fixture-process";
import { createTempFixtureDir, REPO_ROOT } from "../../../helpers/cli-test-utils";
import type { ExtractedDocumentTitleEvidence } from "../../../../src/adapters/codex/document-rename/types";

/** No manual evaluation launchers: compile product entry points beside their fixed assets. */
export async function buildDocxProduct(root: string, formats: Array<"esm" | "cjs"> = ["esm"]) {
  await build({
    config: false,
    entry: {
      entry: join(import.meta.dir, "entry.ts"),
      driver: join(import.meta.dir, "driver.ts"),
      "docx-child": join(REPO_ROOT, "src/docx/runtime/docx-child.ts"),
      "docx-worker": join(REPO_ROOT, "src/docx/runtime/docx-worker.ts"),
      "docx-parser": join(REPO_ROOT, "src/docx/reader.ts"),
    },
    cwd: REPO_ROOT,
    outDir: root,
    platform: "node",
    target: "node22",
    format: formats,
    fixedExtension: true,
    dts: false,
    clean: false,
    logLevel: "silent",
    deps: { onlyBundle: [] },
  });
  await symlink(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "junction");
}

export async function createDocxProductFixture() {
  const root = await createTempFixtureDir("docx-product");
  let stopped = true;
  try {
    await buildDocxProduct(root);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return {
    root,
    async run(mode: string, ...args: string[]) {
      const result = await startFixtureProcess({
        executable: "node",
        args: [join(root, "driver.mjs"), mode, ...args],
        cwd: root,
        env: { PATH: process.env.PATH, NO_COLOR: "1" },
        timeoutMs: 15_000,
        graceMs: 250,
        cleanupMs: 3_000,
        maxOutputBytes: 65_536,
      }).completion;
      stopped &&= result.stopped;
      if (!result.stopped || !result.ok)
        throw new Error(
          `DOCX product fixture failed: ${JSON.stringify(result.issues)} ${result.stderr}`,
        );
      return JSON.parse(result.stdout) as unknown;
    },
    async extract(path: string) {
      return (await this.run("extract", path)) as ExtractedDocumentTitleEvidence;
    },
    async cleanup() {
      if (!stopped) throw new Error("DOCX product fixture process cleanup remains unconfirmed.");
      await rm(root, { recursive: true, force: true });
    },
  };
}
