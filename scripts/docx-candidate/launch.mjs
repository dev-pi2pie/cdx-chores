import { execFileSync } from "node:child_process";
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsdown";

import { withTemporaryWorkspace } from "../docx-baseline/workspace.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
try {
  if (process.argv.length !== 2) throw new Error("This phase supports verification only");
  await withTemporaryWorkspace(async (workspace) => {
    await symlink(join(repo, "node_modules"), join(workspace, "node_modules"), "junction");
    const common = {
      config: false,
      cwd: repo,
      outDir: workspace,
      platform: "node",
      target: "node22",
      fixedExtension: true,
      dts: false,
      clean: false,
      logLevel: "silent",
      deps: { onlyBundle: [] },
    };
    await build({
      ...common,
      entry: {
        reader: "scripts/docx-candidate/adapter.ts",
        "docx-child": "src/docx/runtime/docx-child.ts",
        "docx-worker": "src/docx/runtime/docx-worker.ts",
        "docx-parser": "src/docx/reader.ts",
      },
      format: ["esm", "cjs"],
    });
    await build({
      ...common,
      entry: { compare: "scripts/docx-candidate/run.ts" },
      format: ["esm"],
    });
    for (const format of ["esm", "cjs"]) {
      const output = execFileSync(process.execPath, [join(workspace, "compare.mjs"), format], {
        cwd: repo,
        env: {
          SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
          DOCX_CANDIDATE_WORKSPACE: workspace,
          TMPDIR: workspace,
          TMP: workspace,
          TEMP: workspace,
          NO_COLOR: "1",
        },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (output !== `${format}: passed yes\n`) throw new Error("Unexpected comparison output");
    }
  });
  process.stdout.write("guarded reader: passed yes\n");
} catch {
  process.stdout.write("guarded reader: passed no\n");
  process.exitCode = 1;
}
