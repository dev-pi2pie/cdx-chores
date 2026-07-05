import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../src/adapters/codex/markdown-pdf-template";
import { actionMdPdfProjectCodex } from "../../src/cli/actions/markdown";
import {
  collectMdPdfProjectCodexSignals,
  createMdPdfProjectCodexReportArtifact,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  validateMdPdfProjectCodexProject,
  writeMdPdfProjectCodexBundle,
  writeMdPdfProjectCodexReportArtifact,
  type MarkdownPdfProjectCodexReportArtifact,
} from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng, pathExists } from "../cli-actions-md-to-pdf-template-codex/fixtures";

const BASE_PROFILE = [
  "profile:",
  "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
  "  source: deterministic",
  "  createdAt: 2026-01-01T00:00:00Z",
  "page:",
  "  size: Letter",
  "",
].join("\n");

const SENSITIVE_REPORT_TEXT =
  "Use /Users/alice/private/report.md, file:///Users/alice/private/report.md, ssh://host/private/report.md, smb://server/share/report.md, vscode://file/secrets/report.md, C:\\Users\\Alice\\report.md, \\\\server\\share\\report.md, ./secrets/client-report.md, ../drafts/notes.md, assets/internal-logo.png, https://example.test/private?token=abc, localhost:3000, 127.0.0.1:3000, 127.1:3000, 2130706433:3000, and [::1]:3000";

const SENSITIVE_DIAGNOSTIC_TEXT =
  "Rejected /Users/alice/private/style.css, file:///Users/alice/private/style.css, ssh://host/private/style.css, smb://server/share/style.css, vscode://file/secrets/style.css, C:\\Users\\Alice\\style.css, \\\\server\\share\\style.css, ./secrets/style.css, ../drafts/style.css, assets/internal-style.css, and https://example.test/private?token=abc from localhost:3000, 127.0.0.1:3000, 127.1:3000, 2130706433:3000, and [::1]:3000";

function adaptedProfileRunner(unmatchedDirections: string[] = []): MarkdownPdfCodexProfileRunner {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: "article",
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: unmatchedDirections,
    });
}

function adaptedTemplateResponse(): string {
  return JSON.stringify({
    decision_mode: "adapted",
    template_family: "document-layered",
    recipe_preset: "article",
    slots: {
      recipe_preset: { preset: "article", source: "base-profile" },
      cover: {
        enabled: false,
        byline: "none",
        composition: "media-first-caption",
        image_fit: "",
        image_anchor: "center",
        media_align: "center",
        media_scale: "balanced",
        text_align: "center",
        style: "none",
        orientation_bucket: "unknown",
        fit_pressure: "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: [],
    managed_assets: [],
    warnings: [],
    unsupported_directions: [],
    fallback_reason: "",
  });
}

function noUsableTemplateResponse(reason = "Unsupported template direction."): string {
  return JSON.stringify({
    decision_mode: "no-usable-template",
    template_family: "none",
    recipe_preset: "none",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: false,
        byline: "none",
        composition: "media-first-caption",
        image_fit: "",
        image_anchor: "center",
        media_align: "center",
        media_scale: "balanced",
        text_align: "center",
        style: "none",
        orientation_bucket: "unknown",
        fit_pressure: "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: [],
    managed_assets: [],
    warnings: [reason],
    unsupported_directions: [reason],
    fallback_reason: reason,
  });
}

function stubTemplateRunner(response: string): MarkdownPdfTemplateCodexRunner {
  return async () => response;
}

function expectPrivacySafeReport(reportText: string, fixtureDir: string): void {
  expect(reportText).not.toContain(fixtureDir);
  expect(reportText).not.toContain("/Users/");
  expect(reportText).not.toContain("/private/");
  expect(reportText).not.toContain("file://");
  expect(reportText).not.toContain("ssh://");
  expect(reportText).not.toContain("smb://");
  expect(reportText).not.toContain("vscode://");
  expect(reportText).not.toContain("C:\\");
  expect(reportText).not.toContain("\\\\server");
  expect(reportText).not.toContain("./secrets/");
  expect(reportText).not.toContain("../drafts/");
  expect(reportText).not.toContain("assets/internal");
  expect(reportText).not.toContain("127.0.0.1");
  expect(reportText).not.toContain("127.1");
  expect(reportText).not.toContain("2130706433");
  expect(reportText).not.toContain("[::1]");
  expect(reportText).not.toContain("localhost");
  expect(reportText).not.toContain("http://");
  expect(reportText).not.toContain("https://");
}

function expectRedactedReportText(value: string): void {
  expect(value).toContain("[redacted-path]");
  expect(value).toContain("[redacted-url]");
  expect(value).toContain("[redacted-host]");
  expect(value).not.toContain("/Users/");
  expect(value).not.toContain("file://");
  expect(value).not.toContain("ssh://");
  expect(value).not.toContain("smb://");
  expect(value).not.toContain("vscode://");
  expect(value).not.toContain("C:\\");
  expect(value).not.toContain("\\\\server");
  expect(value).not.toContain("./secrets/");
  expect(value).not.toContain("../drafts/");
  expect(value).not.toContain("assets/internal");
  expect(value).not.toContain("127.0.0.1");
  expect(value).not.toContain("127.1");
  expect(value).not.toContain("2130706433");
  expect(value).not.toContain("[::1]");
  expect(value).not.toContain("https://");
  expect(value).not.toContain("localhost");
}

describe("cli action modules: md pdf-project codex action writes", () => {
  test("writes only requested advisory reports during dry runs", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-dry-run-report", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(outputPath, "project.codex-report.json");
      const existingProfile = "profile:\n  id: existing\n";
      const existingTemplate = "<html>existing</html>\n";
      const existingStyle = "body { color: red; }\n";

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await mkdir(outputPath, { recursive: true });
      await writeFile(join(outputPath, "profile.yml"), existingProfile, "utf8");
      await writeFile(join(outputPath, "template.html"), existingTemplate, "utf8");
      await writeFile(join(outputPath, "style.css"), existingStyle, "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        output: "project-output",
        keepCodexReport: true,
        dryRun: true,
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project signal mode: deterministic");
      expect(stdout.text).toContain("Final decision mode: deterministic");
      expect(stdout.text).toContain("Codex report: project-output/project.codex-report.json");
      expect(stdout.text).toContain("Follow-up render: cdx-chores");
      expect(stdout.text).toContain("'md' 'to-pdf'");
      expect(stdout.text).toContain("Dry run only. No project bundle files were written.");
      expect(await readFile(join(outputPath, "profile.yml"), "utf8")).toBe(existingProfile);
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toBe(existingTemplate);
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toBe(existingStyle);

      const reportText = await readFile(reportPath, "utf8");
      expectPrivacySafeReport(reportText, fixtureDir);
      const report = JSON.parse(reportText) as {
        advisoryOnly: boolean;
        artifactType: string;
        files: Array<{ role: string }>;
        followUpRenderCommand: { args: string[] };
        identities: Record<string, unknown>;
        input: { baseProfile: { basename: string; display: string; redacted: boolean } };
        project: { decisionMode: string; signalMode: string };
        version: number;
      };

      expect(report).toMatchObject({
        advisoryOnly: true,
        artifactType: "markdown-pdf-codex-project-report",
        project: {
          decisionMode: "deterministic",
          signalMode: "deterministic",
        },
        version: 1,
      });
      expect(report.identities).not.toHaveProperty("outputDirectory");
      expect(report.input.baseProfile).toEqual({
        display: "base.yml",
        basename: "base.yml",
        redacted: false,
      });
      expect(report.files.map((file) => file.role)).toEqual([
        "profile",
        "template-html",
        "style-css",
        "project-report",
      ]);
      expect(report.followUpRenderCommand.args).toContain("<input.md>");
      expect(report.followUpRenderCommand.args).toContain("<output.pdf>");
    });
  });

  test("keeps report-only dry runs from targeting reserved project artifact paths", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-dry-run-collision",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");

        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(join(fixtureDir, "cover.json"), "{}", "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              baseProfile: "base.yml",
              codexReportOutput: "project-output/assets/cover.json",
              coverImage: "cover.json",
              dryRun: true,
              output: "project-output",
              overwrite: true,
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes:
              "--codex-report-output cannot be the same path as planned asset assets/cover.json",
          },
        );

        expect(await pathExists(outputPath)).toBe(false);
      },
    );
  });

  test("rejects report output conflicts before writing bundle files", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-report-conflict", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(fixtureDir, "project-report.json");

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(reportPath, "existing report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        displayPathStyle: "absolute",
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      const error = await expectCliError(
        () =>
          actionMdPdfProjectCodex(runtime, {
            baseProfile: "base.yml",
            codexReportOutput: "project-report.json",
            keepCodexReport: true,
            output: "project-output",
            identityUidFactory: () => "abc12345",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "--codex-report-output already exists",
        },
      );
      expect(error.message).toContain("project-report.json");
      expectPrivacySafeReport(error.message, fixtureDir);

      expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "style.css"))).toBe(false);
      expect(await readFile(reportPath, "utf8")).toBe("existing report\n");
    });
  });

  test("redacts local output directory paths from validation errors", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-output-error-redaction",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");

        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(outputPath, "not a directory\n", "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          displayPathStyle: "absolute",
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        const error = await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              baseProfile: "base.yml",
              output: "project-output",
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "Project output path is not a directory",
          },
        );

        expect(error.message).toContain("project-output");
        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("redacts local input paths from early missing-input failures", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-missing-input-redaction",
      async (fixtureDir) => {
        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          displayPathStyle: "absolute",
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        const error = await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              input: "missing.md",
              output: "project-output",
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "FILE_NOT_FOUND",
            exitCode: 2,
            messageIncludes: "missing.md",
          },
        );

        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("redacts local base profile paths from early read failures", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-base-read-redaction",
      async (fixtureDir) => {
        await mkdir(join(fixtureDir, "base.yml"), { recursive: true });

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          displayPathStyle: "absolute",
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        const error = await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              baseProfile: "base.yml",
              output: "project-output",
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "FILE_READ_ERROR",
            exitCode: 2,
            messageIncludes: "base.yml",
          },
        );

        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("redacts local base profile paths from malformed profile failures", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-base-parse-redaction",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "base.json"), "{", "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          displayPathStyle: "absolute",
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        const error = await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              baseProfile: "base.json",
              output: "project-output",
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "base.json",
          },
        );

        expect(error.message).toContain("Failed to parse Markdown PDF profile JSON");
        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("writes validated project bundles and privacy-safe cover metadata", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-bundle-write", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(outputPath, "project.codex-report.json");
      const coverPath = join(fixtureDir, "cover.png");

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(coverPath, minimalPng(1200, 800));

      const { runtime, stderr, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        displayPathStyle: "absolute",
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        coverImage: "cover.png",
        output: "project-output",
        keepCodexReport: true,
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project signal mode: deterministic");
      expect(stdout.text).toContain("Final decision mode: deterministic");
      expect(stdout.text).toContain("Output directory: project-output");
      expect(stdout.text).toContain("Codex report: project-output/project.codex-report.json");
      expect(stdout.text).toContain("Managed assets: 1");
      expect(stderr.text).toContain("Wrote Markdown PDF project bundle:");
      expect(stderr.text).toContain("project-output");
      expectPrivacySafeReport(stdout.text, fixtureDir);
      expectPrivacySafeReport(stderr.text, fixtureDir);
      expect(await readFile(join(outputPath, "profile.yml"), "utf8")).toContain("md-pdf-profile-");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
      expect(await pathExists(join(outputPath, "assets", "cover.png"))).toBe(true);

      const reportText = await readFile(reportPath, "utf8");
      expectPrivacySafeReport(reportText, fixtureDir);
      const report = JSON.parse(reportText) as {
        input: {
          coverImage: {
            dimensions: { height: number; width: number };
            source: { display: string; redacted: boolean };
          };
        };
        managedAssets: Array<{
          bundlePath: string;
          source: { display: string; redacted: boolean };
        }>;
      };
      expect(report.input.coverImage).toMatchObject({
        dimensions: { height: 800, width: 1200 },
        source: { display: "cover.png", redacted: true },
      });
      expect(report.managedAssets).toEqual([
        expect.objectContaining({
          bundlePath: "assets/cover.png",
          source: { display: "cover.png", basename: "cover.png", redacted: true },
        }),
      ]);
    });
  });

  test("redacts local managed asset source paths from read failures", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-asset-read-redaction",
      async (fixtureDir) => {
        const sourceDir = join(fixtureDir, "source");
        const coverPath = join(sourceDir, "cover.png");

        await mkdir(sourceDir, { recursive: true });
        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(coverPath, minimalPng(1200, 800));

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          baseProfile: "base.yml",
          coverImage: "source/cover.png",
          output: "project-output",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
          writeMode: "bundle",
        });
        const profilePhase = await runMdPdfProjectCodexProfilePhase({
          outputPlan,
          runtime,
          signals,
          state,
        });
        const templatePhase = await runMdPdfProjectCodexTemplatePhase({
          outputPlan,
          profilePhase,
          runtime,
          signals,
          state,
        });
        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase,
        });

        await rm(sourceDir, { force: true, recursive: true });
        await writeFile(sourceDir, "not a directory\n", "utf8");

        const error = await expectCliError(
          () =>
            writeMdPdfProjectCodexBundle({
              outputPlan,
              profilePhase,
              runtime,
              signals,
              state,
              templatePhase,
              validation,
            }),
          {
            code: "FILE_READ_ERROR",
            exitCode: 2,
            messageIncludes: "Failed to read managed asset assets/cover.png",
          },
        );

        expect(error.message).toContain("[redacted-path]");
        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("redacts local report target paths from late write failures", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-report-write-redaction",
      async (fixtureDir) => {
        const reportsPath = join(fixtureDir, "reports");

        await mkdir(reportsPath, { recursive: true });
        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          baseProfile: "base.yml",
          codexReportOutput: "reports/project.json",
          output: "project-output",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
          writeMode: "bundle",
        });
        const profilePhase = await runMdPdfProjectCodexProfilePhase({
          outputPlan,
          runtime,
          signals,
          state,
        });
        const templatePhase = await runMdPdfProjectCodexTemplatePhase({
          outputPlan,
          profilePhase,
          runtime,
          signals,
          state,
        });
        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase,
        });

        await rm(reportsPath, { force: true, recursive: true });
        await writeFile(reportsPath, "not a directory\n", "utf8");

        const error = await expectCliError(
          () =>
            writeMdPdfProjectCodexReportArtifact({
              outputPlan,
              profilePhase,
              runtime,
              signals,
              state,
              templatePhase,
              validation,
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "--codex-report-output parent path is not a directory",
          },
        );

        expect(error.message).toContain("reports");
        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("redacts local bundle target paths from late write failures", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-bundle-write-redaction",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");

        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          baseProfile: "base.yml",
          output: "project-output",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
          writeMode: "bundle",
        });
        const profilePhase = await runMdPdfProjectCodexProfilePhase({
          outputPlan,
          runtime,
          signals,
          state,
        });
        const templatePhase = await runMdPdfProjectCodexTemplatePhase({
          outputPlan,
          profilePhase,
          runtime,
          signals,
          state,
        });
        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase,
        });

        await mkdir(join(outputPath, "profile.yml"), { recursive: true });

        const error = await expectCliError(
          () =>
            writeMdPdfProjectCodexBundle({
              outputPlan,
              profilePhase,
              runtime,
              signals,
              state,
              templatePhase,
              validation,
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "planned profile.yml is a directory",
          },
        );

        expect(error.message).toContain("project-output/profile.yml");
        expectPrivacySafeReport(error.message, fixtureDir);
      },
    );
  });

  test("writes report-only diagnostics for no-usable projects without partial bundle files", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-no-usable-report", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(outputPath, "project.codex-report.json");
      const reason = "Unsupported template direction.";

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(
        join(fixtureDir, "report.md"),
        "# Report\n\n| A | B |\n|---|---|\n| 1 | 2 |\n",
        "utf8",
      );

      const { runtime, stderr, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await expectCliError(
        () =>
          actionMdPdfProjectCodex(runtime, {
            input: "report.md",
            baseProfile: "base.yml",
            intent: "custom HTML and CSS cover design",
            output: "project-output",
            keepCodexReport: true,
            profileCodexRunner: adaptedProfileRunner(),
            templateCodexRunner: stubTemplateRunner(noUsableTemplateResponse(reason)),
            identityUidFactory: () => "abc12345",
          }),
        {
          code: "NO_USABLE_PROJECT",
          exitCode: 1,
          messageIncludes: reason,
        },
      );

      expect(stdout.text).toContain("Project signal mode: codex-assisted");
      expect(stdout.text).toContain("Final decision mode: no-usable-project");
      expect(stdout.text).toContain(`Unsupported direction: ${reason}`);
      expect(stderr.text).toContain("Wrote Codex report:");
      expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "style.css"))).toBe(false);
      expect(await pathExists(reportPath)).toBe(true);

      const reportText = await readFile(reportPath, "utf8");
      expectPrivacySafeReport(reportText, fixtureDir);
      const report = JSON.parse(reportText) as {
        files: Array<{ role: string }>;
        followUpRenderCommand?: unknown;
        project: { decisionMode: string; fallbackReason: string };
      };
      expect(report.project).toMatchObject({
        decisionMode: "no-usable-project",
        fallbackReason: reason,
      });
      expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
      expect(report.followUpRenderCommand).toBeUndefined();
    });
  });

  test("does not report forwarded profile directions as unsupported after template adaptation", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-forwarded-direction-handled",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");
        const reportPath = join(outputPath, "project.codex-report.json");
        const forwardedDirection = "cover image first";

        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

        const { runtime, stdout } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        await actionMdPdfProjectCodex(runtime, {
          input: "report.md",
          baseProfile: "base.yml",
          intent: "cover layout",
          output: "project-output",
          keepCodexReport: true,
          profileCodexRunner: adaptedProfileRunner([forwardedDirection]),
          templateCodexRunner: stubTemplateRunner(adaptedTemplateResponse()),
          identityUidFactory: () => "abc12345",
        });

        expect(stdout.text).toContain("Final decision mode: adapted");
        expect(stdout.text).not.toContain(`Unsupported direction: ${forwardedDirection}`);

        const report = JSON.parse(await readFile(reportPath, "utf8")) as {
          unsupportedDirections: string[];
        };
        expect(report.unsupportedDirections).toEqual([]);
        expect(await pathExists(join(outputPath, "profile.yml"))).toBe(true);
        expect(await pathExists(join(outputPath, "template.html"))).toBe(true);
        expect(await pathExists(join(outputPath, "style.css"))).toBe(true);
      },
    );
  });

  test("writes non-dry-run no-usable reports without partial bundle files", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-no-usable-report-non-dry-run",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");
        const reportPath = join(outputPath, "project.codex-report.json");
        const reason = "Unsupported template direction.";

        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(
          join(fixtureDir, "report.md"),
          "# Report\n\n| A | B |\n|---|---|\n| 1 | 2 |\n",
          "utf8",
        );

        const { runtime, stderr, stdout } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              input: "report.md",
              baseProfile: "base.yml",
              intent: "custom HTML and CSS cover design",
              output: "project-output",
              keepCodexReport: true,
              profileCodexRunner: adaptedProfileRunner(),
              templateCodexRunner: stubTemplateRunner(noUsableTemplateResponse(reason)),
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "NO_USABLE_PROJECT",
            exitCode: 1,
            messageIncludes: reason,
          },
        );

        expect(stdout.text).toContain("Project signal mode: codex-assisted");
        expect(stdout.text).toContain("Final decision mode: no-usable-project");
        expect(stdout.text).not.toContain("Dry run only");
        expect(stderr.text).toContain("Wrote Codex report:");
        expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
        expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
        expect(await pathExists(join(outputPath, "style.css"))).toBe(false);
        expect(await pathExists(reportPath)).toBe(true);

        const reportText = await readFile(reportPath, "utf8");
        expectPrivacySafeReport(reportText, fixtureDir);
        const report = JSON.parse(reportText) as {
          files: Array<{ role: string }>;
          project: { decisionMode: string; fallbackReason: string };
        };
        expect(report.project).toMatchObject({
          decisionMode: "no-usable-project",
          fallbackReason: reason,
        });
        expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
      },
    );
  });

  test("redacts sensitive free-form diagnostics from summary and error output", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-terminal-redaction",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(
          join(fixtureDir, "report.md"),
          "# Report\n\n| A | B |\n|---|---|\n| 1 | 2 |\n",
          "utf8",
        );

        const { runtime, stderr, stdout } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        const error = await expectCliError(
          () =>
            actionMdPdfProjectCodex(runtime, {
              input: "report.md",
              baseProfile: "base.yml",
              intent: `custom HTML and CSS cover design. ${SENSITIVE_REPORT_TEXT}`,
              output: "project-output",
              keepCodexReport: true,
              profileCodexRunner: adaptedProfileRunner(),
              templateCodexRunner: stubTemplateRunner(
                noUsableTemplateResponse(SENSITIVE_DIAGNOSTIC_TEXT),
              ),
              identityUidFactory: () => "abc12345",
            }),
          {
            code: "NO_USABLE_PROJECT",
            exitCode: 1,
            messageIncludes: "[redacted-path]",
          },
        );

        expect(error.message).toContain("[redacted-url]");
        expect(error.message).toContain("[redacted-host]");
        expect(stdout.text).toContain("Fallback reason:");
        expect(stdout.text).toContain("Unsupported direction:");
        expect(stdout.text).toContain("[redacted-path]");
        expect(stdout.text).toContain("[redacted-url]");
        expect(stdout.text).toContain("[redacted-host]");
        expectPrivacySafeReport(error.message, fixtureDir);
        expectPrivacySafeReport(stdout.text, fixtureDir);
        expectPrivacySafeReport(stderr.text, fixtureDir);
      },
    );
  });

  test("redacts sensitive free-form report diagnostics at field level", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-report-redaction", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "base.yml",
        intent: SENSITIVE_REPORT_TEXT,
        keepCodexReport: true,
        output: "project-output",
      });
      const signals = await collectMdPdfProjectCodexSignals(runtime, state);
      const outputPlan = await planMdPdfProjectCodexOutput({
        identityUidFactory: () => "abc12345",
        runtime,
        signalMode: signals.modes.project,
        state,
        writeMode: "report-only",
      });
      const profilePhase = await runMdPdfProjectCodexProfilePhase({
        outputPlan,
        profileCodexRunner: adaptedProfileRunner(),
        runtime,
        signals,
        state,
      });
      const templatePhase = await runMdPdfProjectCodexTemplatePhase({
        outputPlan,
        profilePhase,
        runtime,
        signals,
        state,
      });
      templatePhase.phase.fallbackReason = SENSITIVE_DIAGNOSTIC_TEXT;
      templatePhase.phase.warnings = [SENSITIVE_DIAGNOSTIC_TEXT];
      templatePhase.synthesis.unsupportedDirections = [SENSITIVE_DIAGNOSTIC_TEXT];

      const validation = validateMdPdfProjectCodexProject({
        outputPlan,
        profilePhase,
        runtime,
        state,
        templatePhase,
      });
      const report = createMdPdfProjectCodexReportArtifact({
        outputPlan,
        profilePhase,
        runtime,
        signals,
        state,
        templatePhase,
        validation: {
          ...validation,
          fallbackReason: SENSITIVE_DIAGNOSTIC_TEXT,
          results: [
            ...validation.results,
            { name: "raw-reference", status: "failed", message: SENSITIVE_DIAGNOSTIC_TEXT },
          ],
        },
      }) as MarkdownPdfProjectCodexReportArtifact;

      expectRedactedReportText(report.input.intent ?? "");
      expectRedactedReportText(report.project.fallbackReason ?? "");
      expectRedactedReportText(report.phases.template.fallbackReason ?? "");
      expectRedactedReportText(report.phases.template.warnings[0] ?? "");
      expectRedactedReportText(report.unsupportedDirections[0] ?? "");
      expectRedactedReportText(report.validationResults.at(-1)?.message ?? "");
      expectPrivacySafeReport(JSON.stringify(report), fixtureDir);
    });
  });
});
