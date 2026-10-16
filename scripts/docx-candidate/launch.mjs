import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { runCandidateDriver } from "./driver.mjs";
import { HarnessError } from "./harness/index.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const smoke = process.argv.length === 3 && process.argv[2] === "--smoke";
await runCandidateDriver(
  {
    title: "DOCX candidate verification",
    scope: `${smoke ? "smoke" : "full"} comparisons; ESM and CJS`,
    prefix: "cdx-docx-candidate-",
    failure: () => "guarded reader: passed no\n",
  },
  async (harness, workspace) => {
    if (process.argv.length !== 2 && !smoke) throw new Error("Invalid arguments");
    await symlink(join(repo, "node_modules"), join(workspace, "node_modules"), "junction");
    const env = {
      SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
      DOCX_CANDIDATE_WORKSPACE: workspace,
      TMPDIR: workspace,
      TMP: workspace,
      TEMP: workspace,
      NO_COLOR: "1",
    };
    await harness.command(
      process.execPath,
      [join(repo, "scripts/docx-candidate/build-run.mjs"), "comparison", workspace],
      { stage: "build", label: "Build candidate", cwd: repo, env, timeout: 60_000 },
    );
    for (const format of ["esm", "cjs"]) {
      const output = await harness.command(
        process.execPath,
        [join(workspace, "compare.mjs"), format, smoke ? "initial" : "complete"],
        {
          stage: "comparison",
          label: `${format.toUpperCase()} comparisons`,
          cwd: repo,
          env,
          timeout: 120_000,
          progress: true,
        },
      );
      if (output !== `${format}: passed yes\n`)
        throw new HarnessError("comparison", `${format.toUpperCase()} comparisons`);
    }
    return "guarded reader: passed yes\n";
  },
);
