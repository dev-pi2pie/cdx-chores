import { describe, expect, test } from "bun:test";

import { PAGE_NUMBER_RENDERER_HARNESS_DIGEST } from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/contract";
import { publicEvidenceReport } from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/report";
import { publicSafeText } from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/pdf";
import { safeSubprocessEnvironment } from "../../../../scripts/spikes/markdown-pdf-page-number-renderer-evidence/subprocess";

describe("Markdown PDF renderer evidence laboratory and process safety", () => {
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
});
