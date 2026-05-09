import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  selectCodexDocumentTextCandidates,
  selectCodexStaticImageCandidates,
  startAnalyzerProgress,
} from "../src/cli/actions/rename/codex/testing";
import type { CliRuntime, PlannedRename } from "../src/cli/types";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

class CapturedTtyStream {
  public isTTY = true;
  public chunks: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(String(chunk));
    return true;
  }
}

function createProgressRuntime(stdout: CapturedTtyStream): CliRuntime {
  return {
    cwd: process.cwd(),
    colorEnabled: false,
    now: () => new Date("2026-02-25T03:04:05.000Z"),
    platform: process.platform,
    stdout: stdout as unknown as NodeJS.WritableStream,
    stderr: new CapturedTtyStream() as unknown as NodeJS.WritableStream,
    stdin: { isTTY: false } as NodeJS.ReadStream,
    displayPathStyle: "relative",
  };
}

function plannedRename(path: string): PlannedRename {
  return {
    fromPath: path,
    toPath: `${path}.renamed`,
    changed: true,
  };
}

describe("cli action modules: rename codex internals", () => {
  test("startAnalyzerProgress renders and stops the TTY spinner", () => {
    const stdout = new CapturedTtyStream();
    const progress = startAnalyzerProgress(
      createProgressRuntime(stdout),
      "Codex: analyzing 1 file",
    );

    try {
      progress.stop("fallback");
    } finally {
      expect(stdout.chunks[0]).toBe("\rCodex: analyzing 1 file... -");
      expect(stdout.chunks.at(-1)).toBe("\rCodex: analyzing 1 file... fallback\n");
    }
  });

  test("selectCodexDocumentTextCandidates records PDF and DOCX gate reasons", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const dirPath = join(fixtureDir, "rename-codex-doc-gates");
      await mkdir(dirPath, { recursive: true });
      const oversizedPdfPath = join(dirPath, "huge.pdf");
      const oversizedDocxPath = join(dirPath, "huge.docx");
      const missingPdfPath = join(dirPath, "missing.pdf");
      const missingDocxPath = join(dirPath, "missing.docx");

      await writeFile(oversizedPdfPath, Buffer.alloc(20 * 1024 * 1024 + 1));
      await writeFile(oversizedDocxPath, Buffer.alloc(10 * 1024 * 1024 + 1));

      const result = await selectCodexDocumentTextCandidates([
        plannedRename(oversizedPdfPath),
        plannedRename(oversizedDocxPath),
        plannedRename(missingPdfPath),
        plannedRename(missingDocxPath),
      ]);

      expect(result.candidateCount).toBe(4);
      expect(result.eligiblePaths).toEqual([]);
      expect(result.skipReasonByPath.get(oversizedPdfPath)).toBe("pdf_skipped_too_large");
      expect(result.skipReasonByPath.get(oversizedDocxPath)).toBe("docx_skipped_too_large");
      expect(result.skipReasonByPath.get(missingPdfPath)).toBe("pdf_skipped_unreadable");
      expect(result.skipReasonByPath.get(missingDocxPath)).toBe("docx_skipped_unreadable");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("selectCodexDocumentTextCandidates records text document gate reasons", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const dirPath = join(fixtureDir, "rename-codex-text-doc-gates");
      await mkdir(dirPath, { recursive: true });
      const oversizedMarkdownPath = join(dirPath, "huge.md");
      const missingTextPath = join(dirPath, "missing.txt");

      await writeFile(oversizedMarkdownPath, Buffer.alloc(512 * 1024 + 1));

      const result = await selectCodexDocumentTextCandidates([
        plannedRename(oversizedMarkdownPath),
        plannedRename(missingTextPath),
      ]);

      expect(result.candidateCount).toBe(2);
      expect(result.eligiblePaths).toEqual([]);
      expect(result.skipReasonByPath.get(oversizedMarkdownPath)).toBe("doc_skipped_too_large");
      expect(result.skipReasonByPath.get(missingTextPath)).toBe("doc_skipped_unreadable");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("selectCodexDocumentTextCandidates allows documents at exact size limits", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const dirPath = join(fixtureDir, "rename-codex-doc-exact-limits");
      await mkdir(dirPath, { recursive: true });
      const exactMarkdownPath = join(dirPath, "exact.md");
      const exactPdfPath = join(dirPath, "exact.pdf");
      const exactDocxPath = join(dirPath, "exact.docx");

      await writeFile(exactMarkdownPath, Buffer.alloc(512 * 1024));
      await writeFile(exactPdfPath, Buffer.alloc(20 * 1024 * 1024));
      await writeFile(exactDocxPath, Buffer.alloc(10 * 1024 * 1024));

      const result = await selectCodexDocumentTextCandidates([
        plannedRename(exactMarkdownPath),
        plannedRename(exactPdfPath),
        plannedRename(exactDocxPath),
      ]);

      expect(result.candidateCount).toBe(3);
      expect(result.eligiblePaths).toEqual([exactMarkdownPath, exactPdfPath, exactDocxPath]);
      expect(result.skipReasonByPath.size).toBe(0);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("selectCodexStaticImageCandidates allows static images at exact size limit", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const dirPath = join(fixtureDir, "rename-codex-image-exact-limit");
      await mkdir(dirPath, { recursive: true });
      const exactPngPath = join(dirPath, "exact.png");

      await writeFile(exactPngPath, Buffer.alloc(20 * 1024 * 1024));

      const result = await selectCodexStaticImageCandidates([plannedRename(exactPngPath)]);

      expect(result.candidateCount).toBe(1);
      expect(result.eligiblePaths).toEqual([exactPngPath]);
      expect(result.skipReasonByPath.size).toBe(0);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
