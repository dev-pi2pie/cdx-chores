import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsdown";

import { buildCandidateAssets, candidateBuildOptions } from "./build.mjs";
import { packageProcessCleanupUnconfirmed, runPackageCommand } from "./package-process.mjs";

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
const relativeToCandidate = (observed, reference) =>
  observed > reference ? "above-reference" : "within-reference";

async function run(workspace, mode, load) {
  const destination = join(workspace, `${mode}-${load ?? "isolated"}.json`);
  const log = join(workspace, `${mode}-${load ?? "isolated"}.log`);
  let result;
  try {
    result = await runPackageCommand(
      process.execPath,
      [join(workspace, "measure-run.mjs"), mode, workspace, ...(load ? [load] : [])],
      {
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
  } catch (error) {
    const diagnostic = await readFile(log, "utf8").catch(() => "");
    for (const line of diagnostic.split("\n"))
      if (/^(?:baseline )?measurement [A-Za-z0-9-]+: failed$/.test(line))
        process.stderr.write(`${line}\n`);
    throw error;
  }
  await writeFile(destination, result);
  return JSON.parse(await readFile(destination, "utf8"));
}

/** Retain owned artifacts only when process-group settlement could not be established. */
async function withMeasurementWorkspace(run) {
  const workspace = await mkdtemp(join(tmpdir(), "cdx-docx-measure-"));
  try {
    return await run(workspace);
  } finally {
    if (!packageProcessCleanupUnconfirmed()) await rm(workspace, { recursive: true, force: true });
    else process.stderr.write("candidate measurements: cleanup unconfirmed\n");
  }
}

try {
  assert.equal(process.argv.length, 2, "Expected no measurement arguments");
  const summary = await withMeasurementWorkspace(async (workspace) => {
    await symlink(join(repo, "node_modules"), join(workspace, "node_modules"), "junction");
    await buildCandidateAssets(workspace);
    const entries = {
      "measure-run": "scripts/docx-candidate/measure-run.ts",
      "measure-child": "scripts/docx-candidate/measure-child.ts",
      "measure-baseline": "scripts/docx-candidate/measure-baseline.ts",
      "measure-success-worker": "test/document-rename/fixtures/docx-runtime/success-worker.ts",
    };
    for (const transition of ["postparse", "postencode"])
      for (const position of ["below", "at", "above"])
        entries[`measure-${transition}-${position}`] =
          "scripts/docx-candidate/measure-transition.ts";
    await build({ ...candidateBuildOptions(workspace), entry: entries, format: ["esm"] });
    const idle = await run(workspace, "candidate", "idle");
    const loaded = await run(workspace, "candidate", "loaded");
    const baseline = await run(workspace, "baseline");
    assert.equal(idle.candidate.length, 54);
    assert.equal(loaded.candidate.length, 54);
    assert.equal(baseline.baseline.length, 54);
    const all = [...idle.candidate, ...loaded.candidate];
    const supported = all.filter((sample) => sample.kind === "supported");
    const supportedIds = new Set(supported.map((sample) => sample.id));
    const baselineSupported = baseline.baseline.filter((sample) => supportedIds.has(sample.id));
    const childMeasurements = all.flatMap((sample) => (sample.child ? [sample.child] : []));
    const failureIds = [...new Set(all.filter((sample) => !sample.fit).map((sample) => sample.id))];
    const passed = idle.passed && loaded.passed && baseline.passed;
    return {
      passed,
      cases: 18,
      instrumentedCandidateRuns: all.length,
      ordinaryEsmRuns: 36,
      ordinaryCjsRuns: 36,
      supportedInstrumentedRuns: supported.length,
      expectedLimitInstrumentedRuns: all.length - supported.length,
      baselineRuns: baseline.baseline.length,
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
      baselineCompleted: baseline.baseline.every(
        (sample) => sample.confirmedClose && sample.matched,
      ),
      // These are baseline comparisons; candidate caps do not govern baseline success.
      baselineSupportedApiRelativeToCandidateWindow: relativeToCandidate(
        Math.max(...baselineSupported.map((sample) => sample.apiMilliseconds)),
        6_000,
      ),
      baselineSupportedPeakRssRelativeToCandidateCap: relativeToCandidate(
        Math.max(...baselineSupported.map((sample) => sample.peakRssBytes)),
        256 * 1024 * 1024,
      ),
    };
  });
  process.stdout.write(`candidate measurements: passed ${summary.passed ? "yes" : "no"}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!summary.passed) process.exitCode = 1;
} catch {
  process.stderr.write("candidate measurements: runner failed\n");
  process.stdout.write("candidate measurements: passed no\n");
  process.exitCode = 1;
}
