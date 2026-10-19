import { expect, test } from "bun:test";

import { createDocxEvidenceExtractor } from "../../src/adapters/codex/document-rename/extractors/docx";
import type { DocxReadResult } from "../../src/docx/types";

test("DOCX evidence reuses its reader and contains internal runtime failures", async () => {
  const paths: string[] = [];
  const extract = createDocxEvidenceExtractor(async (path) => {
    paths.push(path);
    return {
      ok: false,
      diagnostic:
        paths.length === 1 ? "docx_limit:compressedInputBytes" : "docx_cleanup_unconfirmed",
    };
  });
  expect(await extract("/fixtures/oversized.docx")).toEqual({ reason: "docx_extract_error" });
  expect(await extract("/fixtures/unconfirmed.docx")).toEqual({ reason: "docx_extract_error" });
  expect(paths).toEqual(["/fixtures/oversized.docx", "/fixtures/unconfirmed.docx"]);
});

test("DOCX evidence maps reader rejection and preserves no-title classification", async () => {
  const rejected = createDocxEvidenceExtractor(async () => {
    throw new Error("Internal path or runtime detail");
  });
  expect(await rejected("/fixtures/rejected.docx")).toEqual({ reason: "docx_extract_error" });
  const facts: DocxReadResult = {
    ok: true,
    facts: {
      rawText: "",
      headings: [],
      hasContent: true,
      metadataResult: { reason: "docx_extract_error", warnings: [] },
      diagnostics: [],
    },
  };
  expect(await createDocxEvidenceExtractor(async () => facts)("/fixtures/no-title.docx")).toEqual({
    reason: "docx_no_title_signal",
  });
});
