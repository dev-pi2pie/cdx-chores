import assert from "node:assert/strict";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

const require = createRequire(import.meta.url);
const packageName = "@cdx-chores-private/docx-reader-evaluation";
const [format, input] = process.argv.slice(2);
assert.ok(format === "esm" || format === "cjs");
assert.equal(process.env.NODE_PATH, undefined);
const entry = await realpath(
  format === "esm" ? new URL(import.meta.resolve(packageName)) : require.resolve(packageName),
);
const location = relative(await realpath(process.cwd()), entry);
assert.ok(location !== ".." && !location.startsWith(`..${sep}`) && !isAbsolute(location));
const candidate = format === "esm" ? await import(packageName) : require(packageName);
const expectedHeadings = [
  { level: 1, text: "Installed Ω ∀🕿 report" },
  { level: 2, text: "Installed note heading" },
];
async function success() {
  const result = await candidate.readCandidateDocx(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.facts.headings, expectedHeadings);
  assert.equal(result.facts.rawText, "Installed Ω ∀🕿 report\n\nBody report \n\n");
  assert.equal(result.facts.metadataResult.metadata.title, "Installed metadata report");
  assert.equal(result.facts.metadataResult.metadata.creator, "Synthetic author");
  assert.deepEqual(result.facts.diagnostics, []);
}
await success();
const evidence = await candidate.extractCandidateDocxEvidence(input);
assert.equal(evidence.titleCandidates[0], "Installed metadata report");
assert.deepEqual(
  evidence.headings,
  expectedHeadings.map((item) => item.text),
);
assert.equal(evidence.metadata.extractor, "docx-reader+ooxml");
assert.deepEqual(evidence.authorCandidates, ["Synthetic author"]);
const bytes = await readFile(input);
assert.deepEqual(
  await candidate.readCandidateDocx(input, { limits: { compressedInputBytes: bytes.length - 1 } }),
  { ok: false, diagnostic: "docx_limit:compressedInputBytes" },
);
await success();

// Independent import-time controls exercise the installed real worker's boundary.
// Only its temporary parser asset is substituted, then restored before returning.
const extension = format === "esm" ? ".mjs" : ".cjs";
const parser = join(dirname(entry), `docx-parser${extension}`);
const original = await readFile(parser);
const imports =
  format === "esm"
    ? 'import { readFileSync } from "node:fs"; import { spawnSync } from "node:child_process";'
    : 'const { readFileSync } = require("node:fs"); const { spawnSync } = require("node:child_process");';
const exported =
  format === "esm"
    ? "export { readDocxDocument };"
    : "exports.readDocxDocument = readDocxDocument;";
try {
  await writeFile(
    parser,
    `${imports}
let intercepted = 0;
for (const call of [() => readFileSync("/docx-baseline-synthetic-never-load.png"), () => spawnSync("docx-positive-control")]) {
  try { call(); } catch (error) { if (error?.message === "docx_offline_guard_intercepted") intercepted += 1; }
}
function readDocxDocument() {
  if (intercepted !== 2) throw new Error("package probe was not intercepted");
  return { ok: true, facts: { rawText: "Probe", headings: [], hasContent: true, metadataResult: { warnings: [] }, diagnostics: [] } };
}
${exported}\n`,
  );
  assert.deepEqual(await candidate.readCandidateDocx(input), {
    ok: false,
    diagnostic: "docx_offline_guard_failed",
  });
} finally {
  await writeFile(parser, original);
}
await success();
process.stdout.write(`${format}: passed yes\n`);
