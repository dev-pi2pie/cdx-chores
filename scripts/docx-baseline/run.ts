import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  assertCaseExpectations,
  captureDocx,
  compactResourceCapture,
  exerciseExternalFileRead,
} from "../../test/document-rename/fixtures/docx-baseline/capture";
import type { DocxCapture } from "../../test/document-rename/fixtures/docx-baseline/capture";
import { createBaselineCases } from "../../test/document-rename/fixtures/docx-baseline/corpus/index";
import { createContractCases } from "../../test/document-rename/fixtures/docx-baseline/corpus/contract/index";
import { extractBaselineDocxEvidence } from "../../test/document-rename/fixtures/docx-baseline/extractor";
import { createResourceCases } from "../../test/document-rename/fixtures/docx-baseline/resource-cases";
import { inspectDocxResources } from "./resources";

const repo = process.cwd();
const expectedPath = join(repo, "test/document-rename/fixtures/docx-baseline/expected.json");
const resourceExpectedPath = join(
  repo,
  "test/document-rename/fixtures/docx-baseline/resources.json",
);
const contractExpectedPath = join(
  repo,
  "test/document-rename/fixtures/docx-baseline/contract.json",
);
const timeoutMs = 15_000;
const self = fileURLToPath(import.meta.url);

function runChild(mode: string, path: string, id: string, directory: string): string {
  const workspace = process.env.DOCX_BASELINE_WORKSPACE;
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
    TMPDIR: workspace,
    TMP: workspace,
    TEMP: workspace,
    NO_COLOR: "1",
  };
  const guard =
    mode === "worker-offline"
      ? ["--require", join(repo, "scripts/docx-baseline/offline-guard.cjs")]
      : [];
  return execFileSync(
    process.execPath,
    ["--max-old-space-size=512", ...guard, self, mode, path, id, directory],
    {
      cwd: repo,
      env,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
    },
  );
}

async function materialize(
  item: ReturnType<typeof createBaselineCases>[number],
  directory: string,
) {
  const bytes =
    "fixture" in item.input ? await readFile(join(repo, item.input.fixture)) : item.input.bytes;
  const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
  const path = join(directory, item.id, name);
  await mkdir(join(directory, item.id), { recursive: true });
  await writeFile(path, bytes);
  return { path, bytes };
}

async function main() {
  const [mode, input, id, directory] = process.argv.slice(2);
  if (mode === "worker-offline") {
    assert(input && id && directory);
    const guard = (
      globalThis as unknown as {
        __docxBaselineGuard: {
          counts: Record<string, number>;
          reset(): void;
          positiveControls(): Record<string, number>;
        };
      }
    ).__docxBaselineGuard;
    const positiveControls = guard.positiveControls();
    guard.reset();
    let externalFilePositiveAttempts: Record<string, number> | undefined;
    if (id === "offline-external-file") {
      await exerciseExternalFileRead(input);
      externalFilePositiveAttempts = { ...guard.counts };
      assert(
        Object.keys(guard.counts).some((key) => key.startsWith("fs.")),
        "External-image positive control did not reach the file-read trap",
      );
      guard.reset();
    }
    const capture = await captureDocx(input, directory, id);
    assert.deepEqual(guard.counts, {}, `${id}: external I/O attempted`);
    process.stdout.write(
      JSON.stringify({
        id,
        inputSha256: capture.inputSha256,
        positiveControls,
        externalFilePositiveAttempts,
        observedAttempts: { ...guard.counts },
      }),
    );
    return;
  }
  if (mode === "worker-capture") {
    assert(input && id && directory);
    process.stdout.write(JSON.stringify(await captureDocx(input, directory, id)));
    return;
  }
  if (mode === "worker-measure") {
    assert(input);
    const samples = [];
    for (let index = 0; index < 4; index++) {
      const started = performance.now();
      const result = await extractBaselineDocxEvidence(input);
      samples.push({
        elapsedMs: performance.now() - started,
        outcome: "reason" in result ? result.reason : "evidence",
      });
    }
    process.stdout.write(
      JSON.stringify({
        samples,
        maxRssKiB: process.resourceUsage().maxRSS,
        rssBytesAfter: process.memoryUsage().rss,
      }),
    );
    return;
  }
  assert(
    ["capture", "verify", "measure", "offline", "capture-contract", "verify-contract"].includes(
      mode ?? "",
    ),
    "Use launch.mjs verify|verify-contract|measure|offline, or capture[-contract] --export-stdout",
  );
  const workspace = process.env.DOCX_BASELINE_WORKSPACE;
  assert(workspace, "Use launch.mjs to own the temporary workspace");
  const captureMode = mode === "capture" || mode === "capture-contract";
  const contractMode = mode === "capture-contract" || mode === "verify-contract";
  assert(!captureMode || input === "--export-stdout", "Capture requires --export-stdout");
  const cases = contractMode ? createContractCases() : createBaselineCases();
  const resourceCases = contractMode ? [] : createResourceCases();
  const all = [...cases, ...resourceCases];
  assert.equal(new Set(all.map((item) => item.id)).size, all.length, "Duplicate case IDs");
  const inputs = join(workspace, "inputs");
  await mkdir(inputs, { recursive: true });
  const observations: DocxCapture[] = [];
  const resources = [];
  const measurements = [];
  const offlineChecks = [];
  for (const item of all) {
    if (
      mode === "offline" &&
      ![
        "offline-external-url",
        "offline-external-file",
        "offline-executable-embedded-parts",
        "empty-image-only",
      ].includes(item.id)
    )
      continue;
    const { path, bytes } = await materialize(item, inputs);
    if (mode === "offline") {
      offlineChecks.push(JSON.parse(runChild("worker-offline", path, item.id, inputs)));
    } else if (mode === "measure") {
      const stats = await inspectDocxResources(bytes);
      const measurement = JSON.parse(runChild("worker-measure", path, item.id, inputs));
      measurements.push({ id: item.id, stats, ...measurement });
    } else {
      const captured = JSON.parse(runChild("worker-capture", path, item.id, inputs)) as DocxCapture;
      assertCaseExpectations(item, captured);
      if (cases.includes(item)) observations.push(captured);
      else resources.push(compactResourceCapture(captured));
    }
  }
  if (mode === "offline") {
    assert(offlineChecks.length >= 3, "Missing offline fixture cases");
  } else if (mode === "measure") {
    assert.equal(measurements.length, all.length, "Missing measurements");
    for (const measurement of measurements) {
      assert.equal(measurement.samples.length, 4, "Missing extraction samples");
      assert(measurement.maxRssKiB > 0, "Missing memory measurement");
      assert(
        measurement.samples.every(
          (sample: { elapsedMs: number }) =>
            Number.isFinite(sample.elapsedMs) && sample.elapsedMs >= 0,
        ),
        "Invalid duration measurement",
      );
    }
  } else {
    if (mode === "verify" || mode === "verify-contract") {
      assert.deepEqual(
        observations,
        JSON.parse(await readFile(contractMode ? contractExpectedPath : expectedPath, "utf8")),
        contractMode ? "Complete contract baseline differs" : "Complete semantic baseline differs",
      );
      if (!contractMode)
        assert.deepEqual(
          resources,
          JSON.parse(await readFile(resourceExpectedPath, "utf8")),
          "Resource baseline differs",
        );
    }
    if (captureMode) {
      process.stdout.write(
        JSON.stringify(
          {
            observations,
            resources,
            manifest: all.map((item) => ({
              id: item.id,
              category: item.category,
              variations: item.variations,
              ...(item.execution ? { execution: item.execution } : {}),
              input: "fixture" in item.input ? item.input.fixture : "generated",
              expected: item.expected,
            })),
          },
          null,
          2,
        ) + "\n",
      );
      return;
    }
  }
  process.stdout.write(`${mode}: ${mode === "measure" ? "completed" : "passed"} yes\n`);
}

main().catch(() => {
  process.exitCode = 1;
});
