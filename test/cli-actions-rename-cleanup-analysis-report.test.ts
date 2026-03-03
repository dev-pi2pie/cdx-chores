import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  createRenameCleanupAnalysisCsvRows,
  writeRenameCleanupAnalysisCsv,
  type RenameCleanupAnalyzerEvidence,
  type RenameCleanupCodexSuggestion,
} from "../src/cli/actions";
import { createActionTestRuntime, removeIfPresent } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

const SAMPLE_EVIDENCE: RenameCleanupAnalyzerEvidence = {
  targetKind: "directory",
  targetPath: "/repo/examples/playground/cleanup-analyzer/mixed-family",
  totalCandidateCount: 12,
  sampledCount: 6,
  sampleNames: [
    "Screenshot 2026-03-02 at 4.53.04 PM.png",
    "Sprint Review 2026-03-03.md",
    "draft (4).txt",
  ],
  groupedPatterns: [
    {
      pattern: "screenshot-{timestamp}.png",
      count: 2,
      examples: [
        "Screenshot 2026-03-02 at 4.53.04 PM.png",
        "Screenshot 2026-03-02 at 4.53.05 PM.png",
      ],
    },
    {
      pattern: "draft-{serial}.txt",
      count: 3,
      examples: ["draft (4).txt", "draft (7).txt"],
    },
  ],
};

const SAMPLE_SUGGESTION: RenameCleanupCodexSuggestion = {
  recommendedHints: ["timestamp", "serial"],
  recommendedStyle: "slug",
  recommendedTimestampAction: "remove",
  confidence: 0.86,
  reasoningSummary: "The sampled names cluster around screenshot timestamps and trailing counters.",
};

describe("cli action modules: rename cleanup analysis report csv", () => {
  test("builds grouped analysis rows with overall suggestion fields", () => {
    const { runtime } = createActionTestRuntime({
      cwd: "/repo",
      now: () => new Date("2026-03-03T12:34:56.000Z"),
    });

    const { rows, generatedAt } = createRenameCleanupAnalysisCsvRows(runtime, {
      evidence: SAMPLE_EVIDENCE,
      suggestion: SAMPLE_SUGGESTION,
    });

    expect(generatedAt).toBe("2026-03-03T12:34:56.000Z");
    expect(rows).toEqual([
      {
        report_id: expect.stringMatching(/^20260303T123456Z-[a-f0-9]{8}$/),
        generated_at: "2026-03-03T12:34:56.000Z",
        scope_kind: "directory",
        scope_path: "examples/playground/cleanup-analyzer/mixed-family",
        total_candidate_count: "12",
        sampled_count: "6",
        group_index: "1",
        grouped_pattern: "screenshot-{timestamp}.png",
        group_count: "2",
        representative_examples:
          "Screenshot 2026-03-02 at 4.53.04 PM.png | Screenshot 2026-03-02 at 4.53.05 PM.png",
        recommended_hints: "timestamp,serial",
        recommended_style: "slug",
        recommended_timestamp_action: "remove",
        confidence: "0.86",
        reasoning_summary:
          "The sampled names cluster around screenshot timestamps and trailing counters.",
      },
      {
        report_id: expect.stringMatching(/^20260303T123456Z-[a-f0-9]{8}$/),
        generated_at: "2026-03-03T12:34:56.000Z",
        scope_kind: "directory",
        scope_path: "examples/playground/cleanup-analyzer/mixed-family",
        total_candidate_count: "12",
        sampled_count: "6",
        group_index: "2",
        grouped_pattern: "draft-{serial}.txt",
        group_count: "3",
        representative_examples: "draft (4).txt | draft (7).txt",
        recommended_hints: "timestamp,serial",
        recommended_style: "slug",
        recommended_timestamp_action: "remove",
        confidence: "0.86",
        reasoning_summary:
          "The sampled names cluster around screenshot timestamps and trailing counters.",
      },
    ]);
  });

  test("writes a distinct cleanup analysis csv artifact", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-03-03T12:34:56.000Z"),
      });
      const evidence = {
        ...SAMPLE_EVIDENCE,
        targetPath: join(fixtureDir, "cleanup-analyzer", "mixed-family"),
      };

      const csvPath = await writeRenameCleanupAnalysisCsv(runtime, {
        evidence,
        suggestion: SAMPLE_SUGGESTION,
      });

      expect(csvPath).toMatch(/rename-cleanup-analysis-20260303T123456Z-[a-f0-9]{8}\.csv$/);
      const csvText = await readFile(csvPath, "utf8");
      expect(csvText).toContain("report_id,generated_at,scope_kind,scope_path");
      expect(csvText).toContain("cleanup-analyzer/mixed-family");
      expect(csvText).toContain("screenshot-{timestamp}.png");
      expect(csvText).toContain("timestamp,serial");

      const entries = await readdir(fixtureDir);
      expect(entries.filter((entry) => entry.startsWith("rename-cleanup-analysis-"))).toHaveLength(1);
      expect(entries.filter((entry) => entry.startsWith("rename-plan-"))).toHaveLength(0);

      await removeIfPresent(csvPath);
    });
  });
});
