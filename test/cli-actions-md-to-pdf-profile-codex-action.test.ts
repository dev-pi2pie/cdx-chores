import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfProfileCodex } from "../src/cli/actions";
import { readMarkdownPdfCodexReportArtifact } from "../src/cli/markdown-pdf/codex-report";
import { readMarkdownPdfProfileFile } from "../src/cli/markdown-pdf";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function adaptedRunner(candidateId = "wide-table") {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_fields: {
        toc: { enabled: true, depth: 2 },
      },
      reasoning: "The document has enough structure for a reusable profile.",
      warnings: [],
      unmatched_directions: [],
    });
}

describe("cli action modules: md pdf-profile codex", () => {
  test("writes a generated profile with Codex identity and optional report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "profile-report.json");
      await writeFile(
        inputPath,
        "# Report\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n",
        "utf8",
      );

      const { runtime, stdout, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "profile-report.json",
        codexRunner: adaptedRunner(),
        input: "report.md",
        intent: "wide table report with ToC",
        output: "profile.yml",
      });

      expect(stdout.text).toContain("Decision: adapted");
      expect(stdout.text).toContain("Based on: wide-table");
      expect(stdout.text).toContain("Preset: wide-table");
      expect(stderr.text).toContain("Collecting Markdown PDF profile signals");
      expect(stderr.text).toContain("Wrote Markdown PDF profile: profile.yml");
      const profile = await readMarkdownPdfProfileFile(outputPath);
      const profileIdentity = profile.profile as Record<string, string>;
      expect(profileIdentity.id).toMatch(/^md-pdf-profile-20260615T081500Z-[a-f0-9]{8}$/);
      expect(profileIdentity).toMatchObject({
        basedOn: "wide-table",
        createdAt: "2026-06-15T08:15:00Z",
        preset: "wide-table",
        source: "codex",
      });
      expect(profile.toc).toMatchObject({ enabled: true, depth: 2 });

      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.artifact.advisoryOnly).toBe(true);
      expect(report.profile.id).toBe(profileIdentity.id);
      expect(report.input.path).toBe("report.md");
      expect(report.result.status).toBe("success");
      expect(report.result.acceptedFields).toEqual({ toc: { enabled: true, depth: 2 } });
    });
  });

  test("dry-run previews without writing the profile but can keep a report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-dry-run", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Report\n\n```ts\nconst ok = true;\n```\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "report.json",
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        intent: "article with readable code",
        output: "profile.yml",
      });

      expect(stdout.text).toContain("Dry run only. No profile was written.");
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.profile.outputPath).toBe("profile.yml");
      expect(report.result.status).toBe("success");
    });
  });

  test("uses a base profile as the strongest candidate without mutating it", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-base", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "adapted.yml");
      await writeFile(join(fixtureDir, "report.md"), "# Base\n", "utf8");
      await writeFile(
        basePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260610T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: reader",
          "  preset: reader",
          "  createdAt: 2026-06-10T08:15:00Z",
          "page:",
          "  size: A4",
          "  orientation: portrait",
          "toc:",
          "  enabled: false",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexRunner: adaptedRunner("base-profile"),
        input: "report.md",
        intent: "refine current profile",
        output: "adapted.yml",
      });

      const base = await readFile(basePath, "utf8");
      expect(base).toContain("id: md-pdf-profile-20260610T081500Z-a1b2c3d4");
      const adapted = await readMarkdownPdfProfileFile(outputPath);
      expect(adapted.profile).toMatchObject({
        basedOn: "md-pdf-profile-20260610T081500Z-a1b2c3d4",
        preset: "reader",
      });
      expect(adapted.toc).toMatchObject({ enabled: true, depth: 2 });
    });
  });

  test("records untracked base profiles in the optional report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-untracked-base", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(join(fixtureDir, "report.md"), "# Base\n", "utf8");
      await writeFile(
        basePath,
        ["page:", "  size: A4", "  orientation: portrait", "toc:", "  enabled: false", ""].join(
          "\n",
        ),
        "utf8",
      );

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "report.json",
        codexRunner: adaptedRunner("base-profile"),
        input: "report.md",
        intent: "refine current profile",
        output: "adapted.yml",
      });

      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.selectedBase).toMatchObject({
        basedOn: "untracked-base-profile",
        candidateId: "base-profile",
        path: "base.yml",
        untracked: true,
      });
    });
  });

  test("writes a failure report for no usable profile only when requested", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Unsupported\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "no-profile-report.json",
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "no-usable-profile",
                selected_candidate_id: "none",
                accepted_fields: {},
                reasoning: "Template-only request.",
                warnings: [],
                unmatched_directions: ["custom CSS"],
              }),
            input: "report.md",
            intent: "custom CSS template",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
          exitCode: 1,
          messageIncludes: "did not find a usable",
        },
      );

      await expect(readFile(join(fixtureDir, "profile.yml"), "utf8")).rejects.toThrow();
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "no-profile-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "no-usable-profile" });
    });
  });

  test("writes an unavailable failure report when requested", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-unavailable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.json",
            codexRunner: async () => {
              throw new Error("network unavailable");
            },
            input: "report.md",
            intent: "report",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "unavailable",
        },
      );

      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "codex-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "unavailable" });
    });
  });

  test("writes a malformed-output failure report when Codex returns invalid JSON", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-malformed", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.json",
            codexRunner: async () => "not json",
            input: "report.md",
            intent: "report",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "invalid structured output",
        },
      );

      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "codex-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "malformed-output" });
    });
  });

  test("rejects collisions and invalid base profiles before calling Codex", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-validation", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      await writeFile(join(fixtureDir, "profile.yml"), "existing", "utf8");
      await writeFile(join(fixtureDir, "codex-report.json"), "existing", "utf8");
      await writeFile(join(fixtureDir, "invalid.yml"), "unknown:\n  bad: true\n", "utf8");
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "profile.yml",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "already exists",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "profile.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "profile.json",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "cannot be the same path",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "new.yml",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "already exists",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "invalid.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "new.yml",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown Markdown PDF profile key",
        },
      );
      expect(codexCalls).toBe(0);
    });
  });
});
