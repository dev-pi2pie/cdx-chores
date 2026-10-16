import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import * as mammoth from "mammoth";

import { extractDocxEvidence } from "../../src/adapters/codex/document-rename/extractors/docx";
import { buildDocumentPrompt } from "../../src/adapters/codex/document-rename/prompt";
import { readDocxCoreMetadata } from "../../src/adapters/docx/ooxml-metadata";
import type { DocxBaselineCase } from "./corpus/index";

type Conversion = { value: string; messages: unknown[] } | { error: string };

export interface DocxCapture {
  id: string;
  inputSha256: string;
  html: Conversion;
  rawText: Conversion;
  metadata: Awaited<ReturnType<typeof readDocxCoreMetadata>>;
  result: Awaited<ReturnType<typeof extractDocxEvidence>>;
  prompt: string | null;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function exerciseExternalFileRead(path: string): Promise<void> {
  await mammoth.convertToHtml({ buffer: await readFile(path) }, { externalFileAccess: true });
}

function conversion(
  result: PromiseSettledResult<Awaited<ReturnType<typeof mammoth.convertToHtml>>>,
  path: string,
): Conversion {
  if (result.status === "fulfilled") {
    return { value: result.value.value, messages: result.value.messages };
  }
  const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
  return { error: error.replaceAll(path, basename(path)) };
}

/** Diagnostic conversions are separate from actual adapter execution and timed measurements. */
export async function captureDocx(
  path: string,
  directory: string,
  id: string,
): Promise<DocxCapture> {
  const buffer = await readFile(path);
  const [html, rawText] = await Promise.allSettled([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);
  const metadata = await readDocxCoreMetadata(path);
  const result = await extractDocxEvidence(path);
  return JSON.parse(
    JSON.stringify({
      id,
      inputSha256: sha256(buffer),
      html: conversion(html, path),
      rawText: conversion(rawText, path),
      metadata,
      result,
      prompt:
        "reason" in result
          ? null
          : buildDocumentPrompt({
              evidences: [{ path, evidence: result }],
              workingDirectory: directory,
            }),
    }),
  ) as DocxCapture;
}

/** Independent content assertions accompany whole-object baseline comparisons. */
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
  if (expected.rawEquals !== undefined) assert.equal(text, expected.rawEquals, item.id);
  if (expected.htmlEquals !== undefined) assert.equal(html, expected.htmlEquals, item.id);
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
