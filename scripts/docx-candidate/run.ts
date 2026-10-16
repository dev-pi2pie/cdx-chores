import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { createAdditionalDocxContentProbes } from "../../test/document-rename/fixtures/docx-content-probes";
import { assertCaseExpectations, captureDocx, type DocxCapture } from "../docx-baseline/capture";
import { createCompleteReaderCases, createInitialReaderCases } from "./cases";
import { compareDocxReader } from "./compare";
import type { CandidateModule } from "./compare";

const [format, scope] = process.argv.slice(2);
assert(format === "esm" || format === "cjs");
assert(scope === "initial" || scope === "complete");
const workspace = process.env.DOCX_CANDIDATE_WORKSPACE;
assert(workspace, "Use the owned temporary-workspace launcher");
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
const frozenCases = scope === "initial" ? createInitialReaderCases() : createCompleteReaderCases();
const probes = scope === "initial" ? [] : createAdditionalDocxContentProbes();
assert.equal(
  probes.length,
  scope === "initial" ? 0 : 10,
  "Additional content probe selection changed",
);
const cases = [...frozenCases, ...probes];
assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
for (const item of cases) {
  const bytes = "fixture" in item.input ? await readFile(item.input.fixture) : item.input.bytes;
  const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
  await mkdir(join(directory, item.id));
  const path = join(directory, item.id, name);
  await writeFile(path, bytes);
  try {
    // Additional probes are small synthetic inputs; their live captures stay in memory.
    // Reviewed frozen expectations are never regenerated during verification.
    const expected = frozenCases.includes(item)
      ? baseline.find((value) => value.id === item.id)
      : await captureDocx(path, directory, item.id);
    assert(expected, `${item.id}: missing frozen baseline`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.inputSha256, item.id);
    assertCaseExpectations(item, expected);
    await compareDocxReader(module, item, expected, bytes, path, directory);
  } catch {
    process.stderr.write(`case ${item.id}: failed\n`);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) process.stdout.write(`${format}: passed yes\n`);
