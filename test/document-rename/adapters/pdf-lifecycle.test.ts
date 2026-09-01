import { describe, expect, test } from "bun:test";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  __testOnlyExtractPdfEvidenceWithLoader,
  extractPdfEvidence,
} from "../../../src/adapters/codex/document-rename/extractors/pdf";
import {
  __testOnlyResolvePdfStandardFontDataUrlWith,
  resolvePdfStandardFontDataUrl,
} from "../../../src/adapters/codex/document-rename/extractors/shared";
import { createTempFixtureDir, REPO_ROOT } from "../../helpers/cli-test-utils";

const PDF_FIXTURE_PATH = join(REPO_ROOT, "test", "fixtures", "docs", "metadata-rich.pdf");

function createPdfDocument(options: {
  events: string[];
  pageCleanupError?: Error;
  pageLoadError?: Error;
  textContentError?: Error;
}) {
  return {
    numPages: 1,
    getMetadata: async () => ({ info: { Title: "Lifecycle Test" } }),
    getOutline: async () => null,
    getPage: async () => {
      if (options.pageLoadError) {
        throw options.pageLoadError;
      }
      return {
        getTextContent: async () => {
          if (options.textContentError) {
            throw options.textContentError;
          }
          return { items: [{ str: "Lifecycle evidence" }] };
        },
        cleanup: () => {
          options.events.push("page-cleanup");
          if (options.pageCleanupError) {
            throw options.pageCleanupError;
          }
          return true;
        },
      };
    },
  };
}

describe("pdf extractor resource lifecycle", () => {
  test("repeats real fixture extraction without changing evidence", async () => {
    const first = await extractPdfEvidence(PDF_FIXTURE_PATH);
    const second = await extractPdfEvidence(PDF_FIXTURE_PATH);

    expect(second).toEqual(first);
    expect("reason" in first).toBe(false);
  });

  test("cleans the first page before destroying the loading task across repeats", async () => {
    const events: string[] = [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await __testOnlyExtractPdfEvidenceWithLoader(PDF_FIXTURE_PATH, (source) => {
        expect(source).not.toHaveProperty("worker");
        expect(source).toHaveProperty("standardFontDataUrl");
        expect(
          (source as { standardFontDataUrl?: string }).standardFontDataUrl?.endsWith(
            "/standard_fonts/",
          ),
        ).toBe(true);
        return {
          promise: Promise.resolve(createPdfDocument({ events })),
          destroy: async () => {
            events.push("task-destroy");
          },
        };
      });

      expect("reason" in result).toBe(false);
    }
    expect(events).toEqual(["page-cleanup", "task-destroy", "page-cleanup", "task-destroy"]);
  });

  test("cleans and destroys resources when first-page extraction fails", async () => {
    const events: string[] = [];

    const result = await __testOnlyExtractPdfEvidenceWithLoader(PDF_FIXTURE_PATH, () => ({
      promise: Promise.resolve(
        createPdfDocument({ events, textContentError: new Error("text extraction failed") }),
      ),
      destroy: async () => {
        events.push("task-destroy");
      },
    }));

    expect("reason" in result).toBe(false);
    if ("reason" in result) {
      throw new Error("Expected metadata-derived PDF evidence");
    }
    expect(result.warnings).toContain("pdf_no_page1_text");
    expect(events).toEqual(["page-cleanup", "task-destroy"]);
  });

  test("suppresses cleanup errors without replacing extracted evidence", async () => {
    const events: string[] = [];

    const result = await __testOnlyExtractPdfEvidenceWithLoader(PDF_FIXTURE_PATH, () => ({
      promise: Promise.resolve(
        createPdfDocument({ events, pageCleanupError: new Error("page cleanup failed") }),
      ),
      destroy: async () => {
        events.push("task-destroy");
        throw new Error("task destruction failed");
      },
    }));

    expect("reason" in result).toBe(false);
    if ("reason" in result) {
      throw new Error("Expected evidence despite cleanup failures");
    }
    expect(result.detectedType).toBe("pdf");
    expect(result.filename).toBe("metadata-rich.pdf");
    expect(result.titleCandidates).toContain("Lifecycle Test");
    expect(result.metadata?.pageCount).toBe(1);
    expect(events).toEqual(["page-cleanup", "task-destroy"]);
  });

  test("destroys the loading task without page cleanup when page loading fails", async () => {
    const events: string[] = [];

    const result = await __testOnlyExtractPdfEvidenceWithLoader(PDF_FIXTURE_PATH, () => ({
      promise: Promise.resolve(
        createPdfDocument({ events, pageLoadError: new Error("page loading failed") }),
      ),
      destroy: async () => {
        events.push("task-destroy");
      },
    }));

    expect("reason" in result).toBe(false);
    if ("reason" in result) {
      throw new Error("Expected metadata-derived PDF evidence");
    }
    expect(result.warnings).toContain("pdf_no_page1_text");
    expect(events).toEqual(["task-destroy"]);
  });

  test("destroys the loading task when document loading fails", async () => {
    const events: string[] = [];

    const result = await __testOnlyExtractPdfEvidenceWithLoader(PDF_FIXTURE_PATH, () => ({
      promise: Promise.reject(new Error("document loading failed")),
      destroy: async () => {
        events.push("task-destroy");
      },
    }));

    expect(result).toEqual({ reason: "pdf_extract_error" });
    expect(events).toEqual(["task-destroy"]);
  });
});

describe("pdf standard font resolution", () => {
  test("resolves the installed PDF.js standard-font directory", async () => {
    const standardFontDataUrl = await resolvePdfStandardFontDataUrl();

    expect(standardFontDataUrl).toBeDefined();
    expect(standardFontDataUrl?.endsWith("/standard_fonts/")).toBe(true);
    await access(fileURLToPath(standardFontDataUrl!));
  });

  test("preserves the missing-package fallback", async () => {
    const standardFontDataUrl = await __testOnlyResolvePdfStandardFontDataUrlWith(() => {
      throw new Error("module not found");
    });

    expect(standardFontDataUrl).toBeUndefined();
  });

  test("preserves the missing-standard-font-directory fallback", async () => {
    const fixtureDir = await createTempFixtureDir("pdf-standard-fonts");
    try {
      const standardFontDataUrl = await __testOnlyResolvePdfStandardFontDataUrlWith(() =>
        join(fixtureDir, "missing-package", "package.json"),
      );

      expect(standardFontDataUrl).toBeUndefined();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
