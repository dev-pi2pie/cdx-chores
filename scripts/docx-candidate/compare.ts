import assert from "node:assert/strict";

import { buildDocumentPrompt } from "../../src/adapters/codex/document-rename/prompt";
import {
  stripHtmlTags,
  toSingleLine,
} from "../../src/adapters/codex/document-rename/extractors/shared";
import type { DocxCapture } from "../docx-baseline/capture";
import type { DocxBaselineCase } from "../docx-baseline/corpus/index";
import type * as candidate from "./adapter";

export type CandidateModule = Pick<
  typeof candidate,
  "readDocxDocument" | "extractCandidateDocxEvidence"
>;

/** Match baseline capture serialization, including omitted optional fields. */
function captured<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function compareInitialReader(
  module: CandidateModule,
  item: DocxBaselineCase,
  baseline: DocxCapture,
  bytes: Buffer,
  path: string,
  directory: string,
): Promise<void> {
  const read = await module.readDocxDocument(bytes);
  const result = captured(await module.extractCandidateDocxEvidence(path));
  const expected = structuredClone(baseline.result);
  let expectedPrompt = baseline.prompt;
  if (!("reason" in expected)) {
    const original = expected.metadata?.extractor;
    assert(original === "mammoth" || original === "mammoth+ooxml", item.id);
    const replacement = original === "mammoth" ? "docx-reader" : "docx-reader+ooxml";
    expected.metadata = { ...expected.metadata, extractor: replacement };
    const field = `"extractor": "${original}"`;
    assert.equal(expectedPrompt?.split(field).length, 2, `${item.id}: prompt provenance`);
    expectedPrompt = expectedPrompt!.replace(field, `"extractor": "${replacement}"`);
  }
  assert.deepEqual(result, expected, `${item.id}: complete evidence`);
  const prompt =
    "reason" in result
      ? null
      : buildDocumentPrompt({
          evidences: [{ path, evidence: result }],
          workingDirectory: directory,
        });
  assert.equal(prompt, expectedPrompt, `${item.id}: complete prompt`);

  if ("error" in baseline.html || "error" in baseline.rawText) {
    assert(!read.ok, `${item.id}: conversion failure must fail the reader`);
    return;
  }
  assert(read.ok, `${item.id}: expected document facts`);
  assert.deepEqual(captured(read.facts.metadataResult), baseline.metadata, `${item.id}: metadata`);
  assert.equal(read.facts.rawText, baseline.rawText.value, `${item.id}: raw stream`);
  const headings = [...baseline.html.value.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({ level: Number(match[1]), text: toSingleLine(stripHtmlTags(match[2]!)) }))
    .filter((heading) => heading.text.length > 0);
  assert.deepEqual(
    read.facts.headings.map((heading) => ({ ...heading, text: toSingleLine(heading.text) })),
    headings,
    `${item.id}: ordered heading facts`,
  );
  assert.equal(
    read.facts.hasContent,
    baseline.html.value.trim().length > 0 || baseline.rawText.value.trim().length > 0,
    `${item.id}: content presence`,
  );

  // Synthetic expectations remain independent of the frozen full-object comparison.
  const assertions = item.expected;
  if (assertions.rawEquals !== undefined)
    assert.equal(read.facts.rawText, assertions.rawEquals, item.id);
  for (const text of assertions.rawIncludes ?? [])
    assert(read.facts.rawText.includes(text), `${item.id}: raw missing ${text}`);
  for (const text of assertions.rawExcludes ?? [])
    assert(!read.facts.rawText.includes(text), `${item.id}: raw unexpectedly includes ${text}`);
  let previous = -1;
  for (const text of assertions.rawOrdered ?? []) {
    const position = read.facts.rawText.indexOf(text, previous + 1);
    assert(position > previous, `${item.id}: raw order missing ${text}`);
    previous = position;
  }
  if (assertions.reason) assert.deepEqual(result, { reason: assertions.reason }, item.id);
  if (!("reason" in result)) {
    if (assertions.headings !== undefined)
      assert.deepEqual(result.headings ?? [], assertions.headings, item.id);
    if (assertions.titleFirst !== undefined)
      assert.equal(result.titleCandidates[0], assertions.titleFirst, item.id);
    if (assertions.metadataTitle !== undefined)
      assert.equal(result.metadata?.title, assertions.metadataTitle, item.id);
    for (const warning of assertions.warningsInclude ?? [])
      assert(result.warnings?.includes(warning), `${item.id}: missing warning ${warning}`);
  }
}
