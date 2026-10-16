import { execFileSync } from "node:child_process";
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsdown";

import { withTemporaryWorkspace } from "./workspace.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const [mode = "verify", ...flags] = process.argv.slice(2);
const valid =
  (["verify", "measure", "offline"].includes(mode) && flags.length === 0) ||
  (mode === "capture" && flags.length === 1 && flags[0] === "--export-stdout");

try {
  if (!valid) throw new Error("Invalid baseline invocation");
  const output = await withTemporaryWorkspace(async (workspace) => {
    // External dependencies resolve through this private link; cleanup removes the link itself.
    await symlink(join(repo, "node_modules"), join(workspace, "node_modules"), "junction");
    await build({
      config: false,
      cwd: repo,
      entry: { run: "scripts/docx-baseline/run.ts" },
      outDir: workspace,
      format: ["esm"],
      platform: "node",
      target: "node22",
      fixedExtension: true,
      dts: false,
      clean: false,
      logLevel: "silent",
      deps: { onlyBundle: [] },
    });
    return execFileSync(process.execPath, [join(workspace, "run.mjs"), mode, ...flags], {
      cwd: repo,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
        DOCX_BASELINE_WORKSPACE: workspace,
        TMPDIR: workspace,
        TMP: workspace,
        TEMP: workspace,
        NO_COLOR: "1",
      },
      timeout: 10 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  });
  process.stdout.write(output);
} catch {
  process.stdout.write(`${mode}: ${mode === "measure" ? "completed" : "passed"} no\n`);
  process.exitCode = 1;
}
