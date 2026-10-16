import assert from "node:assert/strict";

import {
  stripHtmlTags,
  toSingleLine,
} from "../../../../src/adapters/codex/document-rename/extractors/shared";
import type { DocxReadResult } from "../../../../src/docx/types";
import { assertCaseExpectations, sha256, type DocxCapture } from "./capture";
import type { DocxBaselineCase } from "./corpus/index";

export interface DocxProductObservation {
  read: DocxReadResult;
  evidence: DocxCapture["result"];
  prompt: string | null;
}

/** Only provenance changes when historical evidence becomes a product expectation. */
export function normalizeDocxProvenance<T extends Pick<DocxCapture, "result" | "prompt">>(
  capture: T,
  id = "DOCX",
): T {
  const expected = structuredClone(capture);
  if ("reason" in expected.result) return expected;
  const original = expected.result.metadata?.extractor;
  assert(original === "mammoth" || original === "mammoth+ooxml", id);
  const replacement = original === "mammoth" ? "docx-reader" : "docx-reader+ooxml";
  expected.result.metadata = { ...expected.result.metadata, extractor: replacement };
  const field = `"extractor": "${original}"`;
  assert.equal(expected.prompt?.split(field).length, 2, `${id}: prompt provenance`);
  expected.prompt = expected.prompt!.replace(field, `"extractor": "${replacement}"`);
  return expected;
}

function headingFacts(html: string) {
  return [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({ level: Number(match[1]), text: toSingleLine(stripHtmlTags(match[2]!)) }))
    .filter((heading) => heading.text.length > 0);
}

/** Compare product facts and evidence; captured HTML is historical expected data only. */
export function assertDocxProductObservation(
  item: DocxBaselineCase,
  baseline: DocxCapture,
  bytes: Buffer,
  observation: DocxProductObservation,
): void {
  assert.equal(baseline.id, item.id, `${item.id}: frozen case identity`);
  assert.equal(sha256(bytes), baseline.inputSha256, `${item.id}: input digest`);
  assertCaseExpectations(item, baseline);
  const expected = normalizeDocxProvenance(baseline, item.id);
  const { read, evidence: result, prompt } = observation;
  assert.deepEqual(result, expected.result, `${item.id}: complete evidence`);
  assert.equal(prompt, expected.prompt, `${item.id}: complete prompt`);

  if ("error" in baseline.html || "error" in baseline.rawText) {
    assert(!read.ok, `${item.id}: historical conversion failure must fail the reader`);
    return;
  }
  assert(read.ok, `${item.id}: expected document facts`);
  assert.deepEqual(
    JSON.parse(JSON.stringify(read.facts.metadataResult)),
    baseline.metadata,
    `${item.id}: metadata`,
  );
  assert.equal(read.facts.rawText, baseline.rawText.value, `${item.id}: raw stream`);
  const headings = read.facts.headings.map((heading) => ({
    ...heading,
    text: toSingleLine(heading.text),
  }));
  assert.deepEqual(
    headings,
    headingFacts(baseline.html.value),
    `${item.id}: ordered heading facts`,
  );
  assert.equal(
    read.facts.hasContent,
    baseline.html.value.trim().length > 0 || baseline.rawText.value.trim().length > 0,
    `${item.id}: content presence`,
  );

  // Synthetic expectations independently cover product-visible consequences of the captures.
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
  if (assertions.htmlEquals !== undefined) {
    assert.deepEqual(
      headings,
      headingFacts(assertions.htmlEquals),
      `${item.id}: expected headings`,
    );
    assert.equal(
      read.facts.hasContent,
      assertions.htmlEquals.trim().length > 0 || read.facts.rawText.trim().length > 0,
      `${item.id}: expected content presence`,
    );
  }
  for (const html of assertions.htmlIncludes ?? []) {
    for (const heading of headingFacts(html))
      assert(
        headings.some((value) => value.level === heading.level && value.text === heading.text),
        `${item.id}: heading missing ${heading.text}`,
      );
  }
  for (const [html, count] of Object.entries(assertions.htmlOccurrences ?? {})) {
    const [heading] = headingFacts(html);
    if (heading)
      assert.equal(
        headings.filter((value) => value.level === heading.level && value.text === heading.text)
          .length,
        count,
        `${item.id}: heading occurrence count for ${heading.text}`,
      );
  }
  for (const text of assertions.htmlExcludes ?? []) {
    if (text.includes("<")) continue;
    for (const value of [
      read.facts.rawText,
      ...headings.map((heading) => heading.text),
      prompt ?? "",
    ])
      assert(!value.includes(text), `${item.id}: product unexpectedly includes ${text}`);
  }
  for (const message of [
    ...(assertions.htmlMessagesInclude ?? []),
    ...(assertions.rawMessagesInclude ?? []),
  ]) {
    const diagnostic = message.includes("Did not understand this style mapping")
      ? "docx_style_map_invalid"
      : /unsupported character|^char /.test(message)
        ? "docx_symbol_unsupported"
        : undefined;
    assert(diagnostic, `${item.id}: missing product diagnostic expectation for ${message}`);
    assert(read.facts.diagnostics.includes(diagnostic), `${item.id}: missing ${diagnostic}`);
  }
  if (assertions.metadataTitle !== undefined) {
    assert(!("reason" in read.facts.metadataResult), `${item.id}: expected available metadata`);
    assert.equal(read.facts.metadataResult.metadata?.title, assertions.metadataTitle, item.id);
  }
  if (assertions.reason) assert.deepEqual(result, { reason: assertions.reason }, item.id);
  if (!("reason" in result)) {
    if (assertions.headings !== undefined)
      assert.deepEqual(result.headings ?? [], assertions.headings, item.id);
    if (assertions.titleFirst !== undefined)
      assert.equal(result.titleCandidates[0], assertions.titleFirst, item.id);
    if (assertions.titleCandidates !== undefined)
      assert.deepEqual(result.titleCandidates, assertions.titleCandidates, item.id);
    if (assertions.metadataTitle !== undefined)
      assert.equal(result.metadata?.title, assertions.metadataTitle, item.id);
    for (const warning of assertions.warningsInclude ?? [])
      assert(result.warnings?.includes(warning), `${item.id}: missing warning ${warning}`);
  }
}
