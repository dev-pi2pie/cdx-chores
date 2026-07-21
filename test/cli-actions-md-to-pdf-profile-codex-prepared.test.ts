import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  bindMarkdownPdfProfileCodexDestination,
  commitPreparedMarkdownPdfProfileCodex,
  prepareMarkdownPdfProfileCodex,
} from "../src/cli/markdown-pdf/profile-codex";
import { readMarkdownPdfCodexReportArtifact } from "../src/cli/markdown-pdf/codex-report";
import { readMarkdownPdfProfileFile } from "../src/cli/markdown-pdf";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function adaptedRunner(onCall: () => void) {
  return async () => {
    onCall();
    return JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: "wide-table",
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [],
      reasoning: "Use the wide-table candidate.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
  };
}

describe("Markdown PDF prepared Profile Codex services", () => {
  test("prepares once, rebinds without writes, and commits the accepted profile", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-prepared", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\n| A | B |\n| - | - |\n", "utf8");
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-22T06:30:00.000Z"),
      });
      let runnerCalls = 0;

      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner(() => {
          runnerCalls += 1;
        }),
        input: "report.md",
        intent: "wide table report",
        keepCodexReport: true,
        output: "first-profile.yml",
        profileUidFactory: () => "md-pdf-profile-20260722T063000Z-prepared",
      });

      expect(prepared.kind).toBe("profile");
      expect(runnerCalls).toBe(1);
      expect(await readdir(fixtureDir)).toEqual(["report.md"]);
      if (prepared.kind !== "profile") {
        throw new Error("Expected a prepared profile.");
      }
      const identityBeforeBinding = structuredClone(prepared.identity);
      const profileBeforeBinding = structuredClone(prepared.finalProfile);

      const destination = await bindMarkdownPdfProfileCodexDestination(runtime, prepared, {
        output: "accepted-profile.yml",
      });

      expect(runnerCalls).toBe(1);
      expect(prepared.identity).toEqual(identityBeforeBinding);
      expect(prepared.finalProfile).toEqual(profileBeforeBinding);
      expect(destination.outputPath).toBe(join(fixtureDir, "accepted-profile.yml"));
      expect(destination.reportOutputPath).toBe(
        join(
          fixtureDir,
          "accepted-profile-md-pdf-profile-20260722T063000Z-prepared-codex-report.json",
        ),
      );
      expect(await readdir(fixtureDir)).toEqual(["report.md"]);

      await commitPreparedMarkdownPdfProfileCodex({ destination, prepared, runtime });

      expect(runnerCalls).toBe(1);
      const writtenProfile = await readMarkdownPdfProfileFile(destination.outputPath);
      expect(writtenProfile).toEqual(prepared.finalProfile);
      const report = await readMarkdownPdfCodexReportArtifact(destination.reportOutputPath!);
      expect(report.profile.id).toBe(prepared.identity.id);
      expect(report.profile.outputPath).toBe("accepted-profile.yml");
    });
  });
});
