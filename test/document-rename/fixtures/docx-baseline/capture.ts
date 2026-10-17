import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import type { DocumentTitleEvidence } from "../../../../src/adapters/codex/document-rename/types";
import type { ReadDocxCoreMetadataResult } from "../../../../src/adapters/docx/ooxml-metadata";
import type { DocxBaselineCase } from "./corpus/index";

type Conversion = { value: string; messages: unknown[] } | { error: string };

export interface DocxCapture {
  id: string;
  inputSha256: string;
  html: Conversion;
  rawText: Conversion;
  metadata: ReadDocxCoreMetadataResult;
  result: DocumentTitleEvidence | { reason: string };
  prompt: string | null;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Validate the independent expectations recorded alongside historical captures. */
export function assertCaseExpectations(item: DocxBaselineCase, capture: DocxCapture): void {
  const expected = item.expected;
  const text = "value" in capture.rawText ? capture.rawText.value : "";
  const html = "value" in capture.html ? capture.html.value : "";
  if (expected.metadataTitle !== undefined) {
    assert(!("reason" in capture.metadata), `${item.id}: expected available metadata`);
    assert.equal(capture.metadata.metadata?.title, expected.metadataTitle, item.id);
  }
  for (const value of expected.rawIncludes ?? [])
    assert(text.includes(value), `${item.id}: raw missing ${value}`);
  for (const value of expected.rawExcludes ?? [])
    assert(!text.includes(value), `${item.id}: raw unexpectedly includes ${value}`);
  for (const value of expected.htmlIncludes ?? [])
    assert(html.includes(value), `${item.id}: HTML missing ${value}`);
  for (const value of expected.htmlExcludes ?? [])
    assert(!html.includes(value), `${item.id}: HTML unexpectedly includes ${value}`);
  for (const [value, count] of Object.entries(expected.htmlOccurrences ?? {}))
    assert.equal(
      html.split(value).length - 1,
      count,
      `${item.id}: HTML occurrence count for ${value}`,
    );
  if (expected.rawEquals !== undefined) {
    assert("value" in capture.rawText, `${item.id}: expected a completed raw conversion`);
    assert.equal(text, expected.rawEquals, item.id);
  }
  if (expected.htmlEquals !== undefined) {
    assert("value" in capture.html, `${item.id}: expected a completed HTML conversion`);
    assert.equal(html, expected.htmlEquals, item.id);
  }
  for (const [conversion, messages] of [
    [capture.html, expected.htmlMessagesInclude],
    [capture.rawText, expected.rawMessagesInclude],
  ] as const) {
    for (const message of messages ?? []) {
      assert("value" in conversion, `${item.id}: expected a completed conversion`);
      assert(
        conversion.messages.some(
          (value) =>
            typeof value === "object" &&
            value !== null &&
            "message" in value &&
            String(value.message).includes(message),
        ),
        `${item.id}: converter warning missing ${message}`,
      );
    }
  }
  for (const [conversion, error] of [
    [capture.html, expected.htmlErrorIncludes],
    [capture.rawText, expected.rawErrorIncludes],
  ] as const) {
    if (error !== undefined) {
      assert("error" in conversion, `${item.id}: expected a failed conversion`);
      assert(conversion.error.includes(error), `${item.id}: converter error missing ${error}`);
    }
  }
  let previous = -1;
  for (const value of expected.rawOrdered ?? []) {
    const position = text.indexOf(value, previous + 1);
    assert(position > previous, `${item.id}: raw order missing ${value}`);
    previous = position;
  }
  if (expected.reason) {
    assert.deepEqual(capture.result, { reason: expected.reason }, item.id);
    assert.equal(capture.prompt, null, item.id);
  } else {
    assert(!("reason" in capture.result), `${item.id}: unexpected extraction failure`);
    if (expected.titleFirst !== undefined)
      assert.equal(capture.result.titleCandidates[0], expected.titleFirst, item.id);
    if (expected.titleCandidates !== undefined)
      assert.deepEqual(capture.result.titleCandidates, expected.titleCandidates, item.id);
    if (expected.headings !== undefined)
      assert.deepEqual(capture.result.headings ?? [], expected.headings, item.id);
    if (expected.metadataTitle !== undefined)
      assert.equal(capture.result.metadata?.title, expected.metadataTitle, item.id);
    for (const value of expected.warningsInclude ?? [])
      assert(capture.result.warnings?.includes(value), `${item.id}: warning missing ${value}`);
    assert(
      capture.prompt?.includes(JSON.stringify(capture.result.metadata?.extractor)),
      `${item.id}: prompt provenance missing`,
    );
  }
}

/** Large stress cases keep full evidence/prompts and digest only their unbounded conversion streams. */
export function compactResourceCapture(capture: DocxCapture) {
  const compact = (value: Conversion) =>
    "value" in value
      ? {
          bytes: Buffer.byteLength(value.value),
          sha256: sha256(value.value),
          messages: value.messages,
        }
      : value;
  return { ...capture, html: compact(capture.html), rawText: compact(capture.rawText) };
}
