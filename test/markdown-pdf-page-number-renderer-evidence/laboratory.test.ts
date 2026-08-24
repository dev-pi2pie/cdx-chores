import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  closeRetainedEvidenceLaboratory,
  initializeEvidenceLaboratory,
  PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
  publicEvidenceReport,
  publicSafeText,
  runRendererEvidence,
  safeSubprocessEnvironment,
} from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import {
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
} from "../fixtures/markdown-pdf/page-number-renderer-contract";
import {
  createMockExecution,
  withEvidenceRoot,
} from "../markdown-pdf/evidence/page-number-support";

describe("Markdown PDF renderer evidence laboratory and process safety", () => {
  test("cleans the laboratory after an unexpected orchestration error", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      await expect(
        runRendererEvidence({
          temporaryRoot,
          uniqueId: "materialization-error-cleanup",
          runner: mock.runner,
          inspectPdf: mock.inspectPdf,
          materializeContract: async () => {
            throw new Error("synthetic materialization failure");
          },
        }),
      ).rejects.toThrow("synthetic materialization failure");
      expect(
        (await readdir(temporaryRoot)).filter((entry) =>
          entry.includes("materialization-error-cleanup"),
        ),
      ).toEqual([]);
    });
  });

  test("treats timeout and bounded-output violations as inconclusive launch failures", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution({
        fail: (request) =>
          request.stage === "doctor" && request.candidateId === "wp-65-1"
            ? {
                exitCode: null,
                stdout: "x".repeat(65_536),
                stderr: "",
                timedOut: true,
                outputTruncated: true,
              }
            : undefined,
      });
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "bounded-output-failure",
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });

      expect(report.outcome).toBe("inconclusive");
      expect(report.failures).toContainEqual(
        expect.objectContaining({
          stage: "doctor",
          classification: "executable-launch-failure",
          message: expect.stringContaining("timed out"),
        }),
      );
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });

  test("rolls back a partially initialized laboratory when marker creation fails", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      expect(
        initializeEvidenceLaboratory({
          temporaryRoot,
          uniqueId: "marker-write-failure",
          initializeMarker: async () => {
            throw new Error("synthetic marker failure");
          },
        }),
      ).rejects.toThrow("synthetic marker failure");
      expect(await readdir(temporaryRoot)).toEqual([]);
    });
  });

  test("cleans successful runs automatically and honors explicit keep", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const automatic = createMockExecution();
      const cleaned = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "automatic-cleanup",
        runner: automatic.runner,
        inspectPdf: automatic.inspectPdf,
      });
      expect(cleaned.outcome).toBe("passed");
      expect(cleaned.retained).toBe(false);
      expect(stat(cleaned.labPath)).rejects.toThrow();

      const explicit = createMockExecution();
      const kept = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "explicit-keep",
        keep: true,
        runner: explicit.runner,
        inspectPdf: explicit.inspectPdf,
      });
      expect(kept.outcome).toBe("passed");
      expect(kept.retained).toBe(true);
      expect((await stat(kept.labPath)).isDirectory()).toBe(true);
      await closeRetainedEvidenceLaboratory(kept.labPath, temporaryRoot);
      expect(stat(kept.labPath)).rejects.toThrow();
    });
  });

  test("closeout requires the exact direct temp child and ownership marker", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      await expect(closeRetainedEvidenceLaboratory(temporaryRoot, temporaryRoot)).rejects.toThrow(
        "unsafe",
      );

      const unmarked = join(temporaryRoot, "cdx-chores-weasyprint-matrix-unmarked");
      await mkdir(unmarked);
      await expect(closeRetainedEvidenceLaboratory(unmarked, temporaryRoot)).rejects.toThrow(
        "without its marker",
      );

      const foreign = join(temporaryRoot, "cdx-chores-weasyprint-matrix-foreign");
      await mkdir(foreign);
      await writeFile(join(foreign, PAGE_NUMBER_LAB_MARKER_NAME), "foreign\n", "utf8");
      await expect(closeRetainedEvidenceLaboratory(foreign, temporaryRoot)).rejects.toThrow(
        "foreign marker",
      );

      const broader = join(temporaryRoot, "unrelated-owned-directory");
      await mkdir(broader);
      await writeFile(
        join(broader, PAGE_NUMBER_LAB_MARKER_NAME),
        PAGE_NUMBER_LAB_MARKER_CONTENT,
        "utf8",
      );
      await expect(closeRetainedEvidenceLaboratory(broader, temporaryRoot)).rejects.toThrow(
        "unsafe",
      );
    });
  });

  test("redacts Unix and Windows paths from public output and omits the lab path", async () => {
    expect(publicSafeText("failed at /Users/alice/private/report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("failed at C:\\Users\\alice\\private\\report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("failed at /workspace/build/report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("failed at E:/build/private/report.json")).toBe(
      "failed at [redacted-path]",
    );
    expect(publicSafeText("see https://example.test/guidance")).toBe(
      "see https://example.test/guidance",
    );
    const publicReport = publicEvidenceReport({
      catalogDigest: "a".repeat(64),
      harnessDigest: PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
      outcome: "inconclusive",
      evidenceStatus: "visual-review-required",
      retained: true,
      labPath: "/private/tmp/cdx-chores-weasyprint-matrix-private",
      bodyHooks: [],
      candidates: [],
      failures: [
        {
          stage: "setup",
          classification: "setup-failure",
          message: "failure at /home/alice/lab and D:\\private\\lab",
        },
      ],
      temporaryImages: [
        {
          candidateId: "wp-65-1",
          scenarioId: "private-image",
          physicalPage: 1,
          path: "/home/alice/lab/page-1.png",
        },
      ],
      visualConclusions: [
        {
          candidateId: "wp-65-1",
          scenarioId: "private-image",
          conclusion: "reviewed at /home/alice/lab/page-1.png",
        },
      ],
      evidenceBoundary: {
        automated: [],
        visualReviewRequired: [],
      },
    });
    expect(publicReport).not.toHaveProperty("labPath");
    expect(publicReport).not.toHaveProperty("temporaryImages");
    expect(publicReport.retained).toBe(false);
    expect(JSON.stringify(publicReport)).not.toContain("alice");
    expect(JSON.stringify(publicReport)).not.toContain("D:\\\\private");
    expect(publicReport.visualConclusions[0]?.conclusion).toBe("reviewed at [redacted-path]");
  });

  test("uses an allowlisted subprocess environment without ambient credentials", () => {
    const secretKey = "CDX_PAGE_NUMBER_TEST_SECRET";
    process.env[secretKey] = "must-not-leak";
    try {
      const environment = safeSubprocessEnvironment("/candidate/bin");
      expect(environment[secretKey]).toBeUndefined();
      expect(environment.PATH?.split(process.platform === "win32" ? ";" : ":")[0]).toBe(
        "/candidate/bin",
      );
      expect(environment.PIP_NO_INPUT).toBe("1");
      expect(environment.PIP_CONFIG_FILE).toBeTruthy();
    } finally {
      delete process.env[secretKey];
    }
  });

  test("writes a retained raw report only inside the owned laboratory", async () => {
    await withEvidenceRoot(async (temporaryRoot) => {
      const mock = createMockExecution();
      const report = await runRendererEvidence({
        temporaryRoot,
        uniqueId: "raw-report",
        keep: true,
        runner: mock.runner,
        inspectPdf: mock.inspectPdf,
      });
      const rawReport = JSON.parse(
        await readFile(join(report.labPath, "results", "renderer-evidence-report.json"), "utf8"),
      ) as { catalogDigest: string; harnessDigest: string; labPath: string };
      expect(rawReport.catalogDigest).toBe(report.catalogDigest);
      expect(rawReport.harnessDigest).toBe(PAGE_NUMBER_RENDERER_HARNESS_DIGEST);
      expect(rawReport.labPath).toBe(report.labPath);
      await closeRetainedEvidenceLaboratory(report.labPath, temporaryRoot);
    });
  });
});
