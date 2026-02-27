import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  __testOnlyBuildDocumentPrompt,
  __testOnlyExtractDocumentTitleEvidenceForPath,
} from "../src/adapters/codex/document-rename-titles";
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

  test("builds unique prompt filenames for duplicate basenames", async () => {
    const fixtureDir = await createTempFixtureDir("doc-prompt");
    try {
      const baseDir = join(fixtureDir, "duplicate-basename");
      const aDir = join(baseDir, "a");
      const bDir = join(baseDir, "b");
      await mkdir(aDir, { recursive: true });
      await mkdir(bDir, { recursive: true });

      const aPath = join(aDir, "report.md");
      const bPath = join(bDir, "report.md");
      await writeFile(aPath, "# Alpha Report\n\nA.\n", "utf8");
      await writeFile(bPath, "# Beta Report\n\nB.\n", "utf8");

      const alpha = await __testOnlyExtractDocumentTitleEvidenceForPath(aPath);
      const beta = await __testOnlyExtractDocumentTitleEvidenceForPath(bPath);
      if (!alpha.evidence || !beta.evidence) {
        throw new Error("Expected markdown evidence");
      }

      const prompt = __testOnlyBuildDocumentPrompt({
        evidences: [
          { path: aPath, evidence: alpha.evidence },
          { path: bPath, evidence: beta.evidence },
        ],
        workingDirectory: baseDir,
      });

      expect(prompt).toContain('"filename": "a/report.md"');
      expect(prompt).toContain('"filename": "b/report.md"');
      expect(prompt).toContain('"basename": "report.md"');
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
