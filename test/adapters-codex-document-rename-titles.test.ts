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

  test("extracts docx evidence from a metadata-rich fixture", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "metadata-rich.docx");

    const result = await __testOnlyExtractDocumentTitleEvidenceForPath(fixturePath);

    expect(result.reason).toBeUndefined();
    if (!result.evidence) {
      throw new Error("Expected docx evidence");
    }

    expect(result.evidence.detectedType).toBe("docx");
    expect(result.evidence.extension).toBe(".docx");
    expect(result.evidence.filename).toBe("metadata-rich.docx");
    expect(result.evidence.titleCandidates[0]).toBe("Quarterly Operating Plan 2026");
    expect(result.evidence.titleCandidates).not.toContain("Goal");
    expect(result.evidence.authorCandidates).toEqual(["Fixture Generator"]);
    expect(result.evidence.metadata?.title).toBe("Quarterly Operating Plan 2026");
    expect(result.evidence.metadata?.extractor).toBe("mammoth+ooxml");
    expect(result.evidence.warnings).toBeUndefined();

    const signalCount =
      result.evidence.titleCandidates.length +
      (result.evidence.headings?.length ?? 0) +
      (result.evidence.leadText ? 1 : 0);
    expect(signalCount > 0).toBe(true);
  });

  test("prefers meaningful lead text over a weak generic heading in docx fixtures", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "weak-heading.docx");

    const result = await __testOnlyExtractDocumentTitleEvidenceForPath(fixturePath);

    expect(result.reason).toBeUndefined();
    if (!result.evidence) {
      throw new Error("Expected docx evidence");
    }

    expect(result.evidence.titleCandidates[0]).toBe("Customer Launch Checklist");
    expect(result.evidence.titleCandidates[1]).toBe("Goal");
    expect(result.evidence.warnings).toEqual(["docx_metadata_unavailable"]);
  });

  test("uses the first non-heading line when a docx fixture has no headings", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "no-heading.docx");

    const result = await __testOnlyExtractDocumentTitleEvidenceForPath(fixturePath);

    expect(result.reason).toBeUndefined();
    if (!result.evidence) {
      throw new Error("Expected docx evidence");
    }

    expect(result.evidence.titleCandidates[0]).toBe("Q2 Hiring Plan");
    expect(result.evidence.headings).toBeUndefined();
    expect(result.evidence.warnings).toEqual(["docx_metadata_unavailable"]);
  });

  test("extracts usable signals from hyperlink-heavy and table-heavy docx fixtures", async () => {
    const hyperlinkFixturePath = join(
      REPO_ROOT,
      "test",
      "fixtures",
      "docs",
      "hyperlink-heavy.docx",
    );
    const tableFixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "table-heavy.docx");

    const hyperlinkResult =
      await __testOnlyExtractDocumentTitleEvidenceForPath(hyperlinkFixturePath);
    const tableResult = await __testOnlyExtractDocumentTitleEvidenceForPath(tableFixturePath);

    expect(hyperlinkResult.reason).toBeUndefined();
    expect(tableResult.reason).toBeUndefined();
    if (!hyperlinkResult.evidence || !tableResult.evidence) {
      throw new Error("Expected docx evidence");
    }

    expect(hyperlinkResult.evidence.titleCandidates[0]).toBe("Partner Reference Guide");
    expect(hyperlinkResult.evidence.leadText).toContain("Collected links");
    expect(tableResult.evidence.titleCandidates[0]).toBe("Roadmap Milestones");
    expect(tableResult.evidence.leadText).toContain("Key delivery milestones");
  });

  test("extracts a strong body-derived title from the alternate-editor textutil fixture", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "textutil-alt-editor.docx");

    const result = await __testOnlyExtractDocumentTitleEvidenceForPath(fixturePath);

    expect(result.reason).toBeUndefined();
    if (!result.evidence) {
      throw new Error("Expected docx evidence");
    }

    expect(result.evidence.titleCandidates[0]).toBe("Partner Enablement Guide");
    expect(result.evidence.metadata?.extractor).toBe("mammoth");
    expect(result.evidence.warnings).toEqual(["docx_metadata_unavailable"]);
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
