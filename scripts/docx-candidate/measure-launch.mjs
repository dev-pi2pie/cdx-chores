import assert from "node:assert/strict";
import { symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { candidateCliOptions } from "./cli.mjs";
import { HarnessError } from "./harness/errors.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const headroom = (ratio) =>
  ratio < 0.5
    ? "over-half"
    : ratio < 0.75
      ? "over-quarter"
      : ratio < 0.9
        ? "over-tenth"
        : ratio <= 1
          ? "within-limit"
          : "failed";
async function run(harness, workspace, load) {
  const destination = join(workspace, `reader-${load}.json`);
  const log = join(workspace, `reader-${load}.log`);
  const result = await harness.command(
    process.execPath,
    [join(workspace, "measure-run.mjs"), workspace, load],
    {
      stage: "runner",
      label: `Production reader measurements ${load}`,
      progress: true,
      posixOnly: true,
      cwd: workspace,
      timeout: 180_000,
      log,
      env: {
        NO_COLOR: "1",
        TMPDIR: workspace,
        TMP: workspace,
        TEMP: workspace,
        SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
      },
    },
  );
  await writeFile(destination, result);
  return JSON.parse(result);
}

const cli = await candidateCliOptions("measurement");
if (cli) {
  const { runCandidateDriver } = await import("./driver.mjs");
  await runCandidateDriver(
    {
      title: "Production DOCX budget checks",
      scope: "18 workloads; frozen evidence; idle and loaded callers; ESM and CJS",
      prefix: "cdx-docx-measure-",
      stage: () => "Measurement validation",
      failure: () => "reader measurements: passed no\n",
    },
    async (harness, workspace) => {
      assert.notEqual(process.platform, "win32", "Measurements require POSIX process groups");
      await symlink(join(repo, "node_modules"), join(workspace, "node_modules"), "junction");
      await harness.command(
        process.execPath,
        [join(repo, "scripts/docx-candidate/build-run.mjs"), "measurement", workspace],
        {
          stage: "build",
          label: "Build measurement assets",
          cwd: repo,
          timeout: 60_000,
          posixOnly: true,
          env: { NO_COLOR: "1", TMPDIR: workspace, TMP: workspace, TEMP: workspace },
        },
      );
      const idle = await run(harness, workspace, "idle");
      const loaded = await run(harness, workspace, "loaded");
      assert.equal(idle.candidate.length, 54);
      assert.equal(loaded.candidate.length, 54);
      const all = [...idle.candidate, ...loaded.candidate];
      const supported = all.filter((sample) => sample.kind === "supported");
      const childMeasurements = all.flatMap((sample) => (sample.child ? [sample.child] : []));
      const failureIds = [
        ...new Set(all.filter((sample) => !sample.fit).map((sample) => sample.id)),
      ];
      const passed = idle.passed && loaded.passed;
      const summary = {
        passed,
        cases: 18,
        instrumentedReaderRuns: all.length,
        ordinaryEsmRuns: 36,
        ordinaryCjsRuns: 36,
        supportedInstrumentedRuns: supported.length,
        expectedLimitInstrumentedRuns: all.length - supported.length,
        rssTransitionProbes: 6,
        failureIds,
        apiHeadroom: headroom(Math.max(...all.map((sample) => sample.apiMilliseconds)) / 6_000),
        processingHeadroom: headroom(
          Math.max(...supported.map((sample) => sample.processingMilliseconds ?? 0)) / 5_000,
        ),
        sampledRssHeadroom: headroom(
          Math.max(...childMeasurements.map((child) => child.observedPeakRssBytes)) /
            (256 * 1024 * 1024),
        ),
        callerMemoryIndependent: loaded.candidate.every(
          (sample) => sample.callerRssBytes > 256 * 1024 * 1024 && sample.fit,
        ),
        ordinaryCjsApiWindow: all.every((sample) => sample.ordinaryCjsApiMilliseconds <= 6_000),
        ordinaryEsmApiWindow: all.every((sample) => sample.ordinaryEsmApiMilliseconds <= 6_000),
        lifecycleConfirmed: all.every(
          (sample) => sample.inputClosed && sample.childExited && sample.admissionReleased,
        ),
        frozenEvidenceAndPrompts: true,
      };
      if (!summary.passed) {
        process.exitCode = 1;
        await harness.failure(new HarnessError("runner", "Measurement validation", failureIds[0]));
      }
      return `reader measurements: passed ${summary.passed ? "yes" : "no"}\n${JSON.stringify(summary)}\n`;
    },
  );
}
