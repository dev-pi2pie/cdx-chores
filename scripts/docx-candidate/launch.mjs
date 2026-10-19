import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { HarnessError } from "./harness/errors.mjs";
import { candidateCliOptions } from "./cli.mjs";
import { prepareSmokeRetention } from "./retention.mjs";
import { smokeCaseIds } from "../../test/document-rename/fixtures/docx-candidate/smoke-case-ids.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const cli = await candidateCliOptions("comparison");
let retention;
if (cli) {
  const { runCandidateDriver } = await import("./driver.mjs");
  await runCandidateDriver(
    {
      title: "Production DOCX verification",
      scope: `${cli.smoke ? "smoke" : "full"} comparisons; ESM and CJS`,
      prefix: "cdx-docx-candidate-",
      failure: () => "guarded reader: passed no\n",
      retain: cli.keepArtifacts
        ? (workspace, outcome) => retention?.publish(workspace, outcome)
        : undefined,
    },
    async (harness, workspace) => {
      if (cli.keepArtifacts)
        retention = await prepareSmokeRetention(repo, { expectedCaseIds: smokeCaseIds });
      await symlink(join(repo, "node_modules"), join(workspace, "node_modules"), "junction");
      const env = {
        SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
        DOCX_CANDIDATE_WORKSPACE: workspace,
        DOCX_CANDIDATE_RETAIN_SMOKE: cli.keepArtifacts ? "1" : "0",
        TMPDIR: workspace,
        TMP: workspace,
        TEMP: workspace,
        NO_COLOR: "1",
      };
      await harness.command(
        process.execPath,
        [join(repo, "scripts/docx-candidate/build-run.mjs"), "comparison", workspace],
        { stage: "build", label: "Build production reader", cwd: repo, env, timeout: 60_000 },
      );
      for (const format of ["esm", "cjs"]) {
        const output = await harness.command(
          process.execPath,
          [join(workspace, "compare.mjs"), format, cli.smoke ? "initial" : "complete"],
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
}
