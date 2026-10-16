import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { createAdditionalDocxContentProbes } from "../../test/document-rename/fixtures/docx-content-probes";
import { ORIGINAL_RESOURCE_RECONCILIATION } from "../../test/document-rename/fixtures/docx-boundary-probes";
import {
  assertCaseExpectations,
  captureDocx,
  type compactResourceCapture,
  type DocxCapture,
} from "../docx-baseline/capture";
import { RESOURCE_BOUNDARIES } from "../docx-baseline/resource-cases";
import { createInitialReaderCases, createValidationReaderCases } from "./cases";
import { compareDocxReader } from "./compare";
import type { CandidateModule } from "./compare";
import { expandResourceCapture } from "./resource-comparison";
import { emitProgress } from "./harness/protocol.mjs";

const [format, scope] = process.argv.slice(2);
assert(format === "esm" || format === "cjs");
assert(scope === "initial" || scope === "complete");
const workspace = process.env.DOCX_CANDIDATE_WORKSPACE;
assert(workspace, "Use the owned temporary-workspace launcher");
const retain = process.env.DOCX_CANDIDATE_RETAIN_SMOKE === "1";
assert(!retain || scope === "initial", "Only smoke artifacts may be staged");
const baseline: DocxCapture[] = [];
for (const file of ["expected.json", "contract.json"]) {
  baseline.push(
    ...(JSON.parse(
      await readFile(`test/document-rename/fixtures/docx-baseline/${file}`, "utf8"),
    ) as DocxCapture[]),
  );
}
const module: CandidateModule =
  format === "esm"
    ? await import(pathToFileURL(join(workspace, "reader.mjs")).href)
    : createRequire(import.meta.url)(join(workspace, "reader.cjs"));
const directory = join(workspace, format);
await mkdir(directory);
const frozenCases =
  scope === "initial" ? createInitialReaderCases() : createValidationReaderCases();
if (scope === "complete") {
  const resources = JSON.parse(
    await readFile("test/document-rename/fixtures/docx-baseline/resources.json", "utf8"),
  ) as ReturnType<typeof compactResourceCapture>[];
  assert.equal(resources.length, 21);
  for (const capture of resources) {
    const item = frozenCases.find((value) => value.id === capture.id);
    const sentinel = item?.expected.rawIncludes?.[0];
    assert(sentinel, `${capture.id}: missing independent resource sentinel`);
    baseline.push(expandResourceCapture(capture, sentinel));
  }
}
const probes = scope === "initial" ? [] : createAdditionalDocxContentProbes();
assert.equal(
  probes.length,
  scope === "initial" ? 0 : 10,
  "Additional content probe selection changed",
);
const cases = [...frozenCases, ...probes];
assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
await emitProgress({ event: "scope", total: cases.length });
let completed = 0;
for (const item of cases) {
  await emitProgress({ event: "start", id: item.id });
  const bytes = "fixture" in item.input ? await readFile(item.input.fixture) : item.input.bytes;
  const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
  await mkdir(join(directory, item.id));
  const path = join(directory, item.id, name);
  await writeFile(path, bytes);
  const artifactDirectory = retain
    ? join(workspace, "smoke-artifacts", format, item.id)
    : undefined;
  let artifact: {
    id: string;
    format: string;
    outcome: "pending" | "passed" | "failed";
    read?: unknown;
    evidence?: unknown;
  } = { id: item.id, format, outcome: "pending" };
  const saveArtifact = async () => {
    if (!artifactDirectory) return;
    const pending = join(workspace, `${format}-${item.id}.pending`);
    await writeFile(pending, JSON.stringify(artifact, null, 2) + "\n");
    await rename(pending, join(artifactDirectory, "result.json"));
  };
  if (artifactDirectory) {
    await mkdir(artifactDirectory, { recursive: true });
    const pending = join(workspace, `${format}-${item.id}.docx.pending`);
    await writeFile(pending, bytes);
    await rename(pending, join(artifactDirectory, "input.docx"));
    await saveArtifact();
  }
  try {
    // Additional probes are small synthetic inputs; their live captures stay in memory.
    // Reviewed frozen expectations are never regenerated during verification.
    const expected = frozenCases.includes(item)
      ? baseline.find((value) => value.id === item.id)
      : await captureDocx(path, directory, item.id);
    assert(expected, `${item.id}: missing frozen baseline`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.inputSha256, item.id);
    assertCaseExpectations(item, expected);
    const boundary = RESOURCE_BOUNDARIES.find((value) => value.caseId === item.id);
    const diagnostic =
      boundary?.position === "above"
        ? ORIGINAL_RESOURCE_RECONCILIATION[boundary.metric].aboveDiagnostic
        : undefined;
    if (boundary && diagnostic) {
      assert(module.readCandidateDocx && module.createCandidateEvidenceExtractor);
      assert(!("reason" in expected.result), `${item.id}: baseline extraction succeeded`);
      assert.deepEqual(await module.readCandidateDocx(path), { ok: false, diagnostic });
      assert.deepEqual(await module.extractCandidateDocxEvidence(path), {
        reason: "docx_extract_error",
      });
      // Raised-cap comparison is a semantic probe, not evidence of default support.
      const read = (input: string) =>
        module.readCandidateDocx!(input, {
          limits: { [boundary.metric]: boundary.measuredTarget },
        });
      await compareDocxReader(
        {
          ...module,
          readCandidateDocx: read,
          extractCandidateDocxEvidence: module.createCandidateEvidenceExtractor(read),
        },
        item,
        expected,
        bytes,
        path,
        directory,
      );
    } else
      await compareDocxReader(
        module,
        item,
        expected,
        bytes,
        path,
        directory,
        retain
          ? async (observed) => {
              artifact = { ...artifact, ...observed };
              await saveArtifact();
            }
          : undefined,
      );
    artifact.outcome = "passed";
    await saveArtifact();
    await emitProgress({ event: "complete", id: item.id, completed: ++completed });
  } catch {
    artifact.outcome = "failed";
    await saveArtifact();
    process.stderr.write(`case ${item.id}: failed\n`);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) process.stdout.write(`${format}: passed yes\n`);
