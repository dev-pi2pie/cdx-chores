import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { __testOnlyExtractDocumentTitleEvidenceForPath } from "../src/adapters/codex/document-rename-titles";
import { createTempFixtureDir, REPO_ROOT, toRepoRelativePath } from "./helpers/cli-test-utils";

describe("codex document rename title extractor", () => {
  test("extracts pdf evidence from a metadata-rich fixture", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "metadata-rich.pdf");

    const result = await __testOnlyExtractDocumentTitleEvidenceForPath(fixturePath);

    expect(result.reason).toBeUndefined();
    if (!result.evidence) {
      throw new Error("Expected pdf evidence");
    }

    expect(result.evidence.detectedType).toBe("pdf");
    expect(result.evidence.extension).toBe(".pdf");
    expect(result.evidence.filename).toBe("metadata-rich.pdf");
    expect(typeof result.evidence.metadata?.pageCount).toBe("number");
    expect((result.evidence.metadata?.pageCount as number) > 0).toBe(true);

    const signalCount =
      result.evidence.titleCandidates.length +
      (result.evidence.headings?.length ?? 0) +
      (result.evidence.leadText ? 1 : 0);
    expect(signalCount > 0).toBe(true);
  });

  test("returns pdf_no_text for weak/no-text pdf proxy fixture", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "no-text-proxy.pdf");

    const result = await __testOnlyExtractDocumentTitleEvidenceForPath(fixturePath);

    expect(result).toEqual({ reason: "pdf_no_text" });
  });

  test("returns pdf_extract_error for unreadable/invalid pdf bytes", async () => {
    const fixtureDir = await createTempFixtureDir("pdf-extractor");
    try {
      const dirPath = join(fixtureDir, "invalid-pdf");
      await mkdir(dirPath, { recursive: true });
      const invalidPdfPath = join(dirPath, "broken.pdf");
      await writeFile(invalidPdfPath, "not a real pdf", "utf8");

      const result = await __testOnlyExtractDocumentTitleEvidenceForPath(invalidPdfPath);

      expect(result).toEqual({ reason: "pdf_extract_error" });
      expect(toRepoRelativePath(invalidPdfPath)).toContain("examples/playground/.tmp-tests");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
