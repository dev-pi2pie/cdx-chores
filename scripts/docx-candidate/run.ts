import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { DocxCapture } from "../docx-baseline/capture";
import { createInitialReaderCases } from "./cases";
import { compareInitialReader } from "./compare";
import type { CandidateModule } from "./compare";

const [format] = process.argv.slice(2);
assert(format === "esm" || format === "cjs");
const workspace = process.env.DOCX_CANDIDATE_WORKSPACE;
assert(workspace, "Use the owned temporary-workspace launcher");
const baseline = JSON.parse(
  await readFile("test/document-rename/fixtures/docx-baseline/expected.json", "utf8"),
) as DocxCapture[];
const module: CandidateModule =
  format === "esm"
    ? await import(pathToFileURL(join(workspace, "reader.mjs")).href)
    : createRequire(import.meta.url)(join(workspace, "reader.cjs"));
const directory = join(workspace, format);
await mkdir(directory);
for (const item of createInitialReaderCases()) {
  const expected = baseline.find((value) => value.id === item.id);
  assert(expected, `${item.id}: missing frozen baseline`);
  const bytes = "fixture" in item.input ? await readFile(item.input.fixture) : item.input.bytes;
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.inputSha256, item.id);
  const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
  await mkdir(join(directory, item.id));
  const path = join(directory, item.id, name);
  await writeFile(path, bytes);
  await compareInitialReader(module, item, expected, bytes, path, directory);
}
process.stdout.write(`${format}: passed yes\n`);
