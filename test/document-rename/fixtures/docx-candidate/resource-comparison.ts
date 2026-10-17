import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import type { compactResourceCapture, DocxCapture } from "../docx-baseline/capture";

/** Reconstruct only independently known minimal streams, validating their frozen digests. */
export function expandResourceCapture(
  capture: ReturnType<typeof compactResourceCapture>,
  sentinel: string,
): DocxCapture {
  const html = `<p>${sentinel}</p>`;
  const rawText = `${sentinel}\n\n`;
  for (const [stream, value] of [
    [capture.html, html],
    [capture.rawText, rawText],
  ] as const) {
    assert("bytes" in stream && "sha256" in stream, `${capture.id}: expected compact stream`);
    assert.equal(Buffer.byteLength(value), stream.bytes, `${capture.id}: stream bytes`);
    assert.equal(
      createHash("sha256").update(value).digest("hex"),
      stream.sha256,
      `${capture.id}: stream digest`,
    );
  }
  assert("messages" in capture.html && "messages" in capture.rawText);
  return {
    ...capture,
    html: { value: html, messages: capture.html.messages },
    rawText: { value: rawText, messages: capture.rawText.messages },
  };
}
