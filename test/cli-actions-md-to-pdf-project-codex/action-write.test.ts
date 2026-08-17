import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../src/adapters/codex/markdown-pdf-template";
import { actionMdPdfProjectCodex, actionMdToPdf } from "../../src/cli/actions/markdown";
import type { MarkdownPdfProcessRunner } from "../../src/cli/markdown-pdf";
import {
  collectMdPdfProjectCodexSignals,
  createMdPdfProjectCodexReportArtifact,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  printMdPdfProjectCodexSummary,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  validateMdPdfProjectBundleCompleteness,
  validateMdPdfProjectCodexProject,
  writeMdPdfProjectCodexBundle,
  writeMdPdfProjectCodexReportArtifact,
  writeMdPdfProjectCodexReportIfRequested,
  type MarkdownPdfProjectCodexReportArtifact,
} from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { createPdfRunner } from "../cli-actions-md-to-pdf.helpers";
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
const TERMINAL_CONTROL_DIAGNOSTIC_TEXT = `${SENSITIVE_DIAGNOSTIC_TEXT} \u001B[31munsafe\u001B[0m \u0007bell`;

function expectManagedProjectTemplateRoles(
  templateHtml: string,
  expected: { cover: boolean; metadataTitle: boolean },
): void {
  const coverIndex = templateHtml.indexOf('<section class="pdf-cover');
  const tocIndex = templateHtml.indexOf('<nav id="TOC" role="doc-toc">');
  const bodyIndex = templateHtml.indexOf('<main class="document-body">');
  const titleIndex = templateHtml.indexOf('<header class="document-title">');
  const bodyContentIndex = templateHtml.indexOf("$body$");

  expect(templateHtml).toContain("$if(toc)$");
  expect(tocIndex).toBeGreaterThanOrEqual(0);
  expect(templateHtml.match(/<main class="document-body">/g)).toHaveLength(1);
  expect(tocIndex).toBeLessThan(bodyIndex);
  expect(bodyIndex).toBeLessThan(bodyContentIndex);

  if (expected.cover) {
    expect(coverIndex).toBeGreaterThanOrEqual(0);
    expect(coverIndex).toBeLessThan(tocIndex);
  } else {
    expect(coverIndex).toBe(-1);
  }

  if (expected.metadataTitle) {
    expect(bodyIndex).toBeLessThan(titleIndex);
    expect(titleIndex).toBeLessThan(bodyContentIndex);
  } else {
    expect(titleIndex).toBe(-1);
  }
}

function adaptedProfileRunner(unmatchedDirections: string[] = []): MarkdownPdfCodexProfileRunner {
  return async ({ prompt }) =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: prompt.includes('"id": "base-profile"') ? "base-profile" : "article",
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: unmatchedDirections,
    });
}

function profilePromptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("profile Codex prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

function duplicateTitleProfileRunner(): MarkdownPdfCodexProfileRunner {
  return async ({ prompt }) => {
    const facts = profilePromptFacts(prompt);
    expect(facts.titleDecisionSignal).toMatchObject({
      duplicateVisibleTitleRisk: true,
      supportedPatch: "/titleBlock/metadataTitle",
    });
    return JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: "article",
      accepted_patches: [{ op: "replace", path: "/titleBlock/metadataTitle", value: "auto" }],
      accepted_font_patches: [],
      reasoning: "The first H1 already provides the visible title.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
  };
}

function adaptedTemplateResponse(
  fontDecisions: Array<{
    family: string;
    key: string;
    role: string;
    source: string;
    template_level: boolean;
  }> = [],
): string {
  return JSON.stringify({
    decision_mode: "adapted",
    template_family: "document-layered",
    recipe_preset: "article",
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
    font_decisions: fontDecisions,
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

async function prepareWriteValidationFixture(
  fixtureDir: string,
  baseProfile: string,
  options: { report?: boolean } = {},
) {
  await writeFile(join(fixtureDir, "base.yml"), baseProfile, "utf8");
  await writeFile(join(fixtureDir, "report.md"), "# Validation report\n\nBody content.\n", "utf8");
  const { runtime } = createActionTestRuntime({
    cwd: fixtureDir,
    now: () => new Date("2026-07-04T08:00:00.000Z"),
  });
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
    baseProfile: "base.yml",
    ...(options.report === false ? {} : { codexReportOutput: "project-validation-report.json" }),
    input: "report.md",
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
  return { outputPlan, profilePhase, runtime, signals, state, templatePhase };
}

describe("cli action modules: md pdf-project codex action writes", () => {
  test("reviews the contained Profile policy separately through the public handoff", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-handoff-review", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
          "  source: deterministic",
          "  createdAt: 2026-01-01T00:00:00Z",
          "header:",
          "  center: Existing page chrome",
          "pageNumbers:",
          "  enabled: true",
          "  scope: document",
          "  countFrom: document",
          "  start: 4",
          "  increment: 2",
          "  position: top-center",
          "  format: 'Page /Users/alice/private/{page} of {pages}'",
          "",
        ].join("\n"),
        "utf8",
      );
      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        dryRun: true,
        output: "project-output",
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Contained Profile:");
      expect(stdout.text).toContain("Effective page numbers: enabled=yes, scope=document");
      expect(stdout.text).toContain("Capability requirements:");
      expect(stdout.text).toContain("pageNumbers.start (minimum 65.1");
      expect(stdout.text).toContain("Template presentation:");
      expect(stdout.text).toContain("Project orchestration:");
      expect(stdout.text).toContain("Project artifacts: planned");
      expect(stdout.text).toContain("Follow-up render usability: planned");
      expect(stdout.text).toContain("Project warning [MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED]");
      expect(
        stdout.text.match(/Project warning \[MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED\]/g),
      ).toHaveLength(1);
      expect(stdout.text).not.toContain("MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION");
      expect(stdout.text).toContain("Follow-up render: cdx-chores");
      expect(stdout.text).not.toContain("--enable-page-numbers");
      expect(stdout.text).not.toContain("--disable-page-numbers");
      expect(stdout.text).toContain("[redacted-path]");
      expect(stdout.text).not.toContain("/Users/alice/private");
    });
  });

  test("reviews disabled page numbers without unnecessary capabilities or unsafe flags", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-disabled-review", async (fixtureDir) => {
      const inputName = "client's report.md";
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "pageNumbers:",
          "  enabled: false",
          "  scope: document",
          "  countFrom: document",
          "  start: 0",
          "  increment: 2",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(join(fixtureDir, inputName), "# Disabled page numbers\n", "utf8");
      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        dryRun: true,
        input: inputName,
        output: "project bundle",
        identityUidFactory: () => "abc12345",
        profileCodexRunner: adaptedProfileRunner(),
      });

      expect(stdout.text).toContain(
        "Effective page numbers: enabled=no, scope=document, countFrom=document, start=0, increment=2",
      );
      expect(stdout.text).toContain("Capability requirements: none");
      expect(stdout.text).not.toContain("Project warning [");
      expect(stdout.text).toContain("'--input' 'client'\\''s report.md'");
      expect(stdout.text).toContain("'--bundle' 'project bundle'");
      for (const forbiddenFlag of [
        "--profile",
        "--template",
        "--css",
        "--enable-page-numbers",
        "--disable-page-numbers",
      ]) {
        expect(stdout.text).not.toContain(forbiddenFlag);
      }
    });
  });

  test("prints real legacy validation diagnostics once in Project summary order", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-migration-summary",
      async (fixtureDir) => {
        const { outputPlan, profilePhase, runtime, signals, state, templatePhase } =
          await prepareWriteValidationFixture(fixtureDir, BASE_PROFILE, { report: false });
        const legacyProfilePhase = {
          ...profilePhase,
          finalProfile: {
            ...profilePhase.finalProfile,
            schemaVersion: 1,
            pageNumbers: {
              enabled: true,
              format: "Page {page} of {pages}",
            },
          },
        };
        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase: legacyProfilePhase,
          runtime,
          state,
          templatePhase,
        });
        const reportArtifact = createMdPdfProjectCodexReportArtifact({
          outputPlan,
          profilePhase: legacyProfilePhase,
          runtime,
          signals,
          state,
          templatePhase,
          validation,
        });

        printMdPdfProjectCodexSummary(runtime, {
          outputPlan,
          profilePhase: legacyProfilePhase,
          reportArtifact,
          state,
        });

        const stdout = (runtime.stdout as NodeJS.WritableStream & { text: string }).text;
        const stale = "Project warning [MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE]";
        const migration = "Project warning [MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION]";
        expect(stdout.match(/MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE/g)).toHaveLength(1);
        expect(stdout.match(/MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION/g)).toHaveLength(1);
        expect(stdout.indexOf(stale)).toBeGreaterThanOrEqual(0);
        expect(stdout.indexOf(migration)).toBeGreaterThan(stdout.indexOf(stale));
        expect(stdout).toContain("declares schemaVersion 1");
        expect(stdout).toContain("countFrom: document");
      },
    );
  });

  test("writes real legacy validation diagnostics through the requested Project report", async () => {
    for (const declaredRevision of [1, 2] as const) {
      await withTempFixtureDir(
        `md-pdf-project-codex-action-migration-report-r${declaredRevision}`,
        async (fixtureDir) => {
          const { outputPlan, profilePhase, runtime, signals, state, templatePhase } =
            await prepareWriteValidationFixture(fixtureDir, BASE_PROFILE);
          const inferredRevision = declaredRevision === 1 ? 2 : 3;
          const legacyProfilePhase = {
            ...profilePhase,
            finalProfile: {
              ...profilePhase.finalProfile,
              schemaVersion: declaredRevision,
              pageNumbers: {
                enabled: true,
                format: "Page {page} of {pages}",
                ...(declaredRevision === 2 ? { start: 0 } : {}),
              },
            },
          };
          const validation = validateMdPdfProjectCodexProject({
            outputPlan,
            profilePhase: legacyProfilePhase,
            runtime,
            state,
            templatePhase,
          });

          await writeMdPdfProjectCodexReportIfRequested({
            outputPlan,
            profilePhase: legacyProfilePhase,
            runtime,
            signals,
            state,
            templatePhase,
            validation,
          });

          if (!outputPlan.report) {
            throw new Error("expected a requested Project report");
          }
          const report = JSON.parse(await readFile(outputPlan.report.path, "utf8")) as {
            handoff: {
              diagnostics: Array<{
                conditionId: string;
                context: Record<string, unknown>;
                message: string;
                severity: string;
              }>;
            };
          };
          const expectedMigrationMessage = `This Profile declares schemaVersion ${declaredRevision}. {pages} now means the final logical page number for countFrom: document. To show the rendered PDF page count, replace {pages} with {pdfPages}.`;
          expect(report.handoff.diagnostics).toEqual([
            {
              conditionId: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE",
              severity: "warning",
              message: `Profile schemaVersion ${declaredRevision} is below inferred Profile revision ${inferredRevision}. Supported Profile content will continue to render.`,
              context: {
                kind: "profile-schema-version",
                state: "stale",
                declaredRevision,
                inferredRevision,
                currentRevision: 3,
              },
            },
            {
              conditionId: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
              severity: "warning",
              message: expectedMigrationMessage,
              context: {
                kind: "legacy-pages-token-migration",
                countFrom: "document",
                declaredRevision,
              },
            },
          ]);
          expect(
            report.handoff.diagnostics.filter(
              ({ conditionId }) => conditionId === "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE",
            ),
          ).toHaveLength(1);
          expect(
            report.handoff.diagnostics.filter(
              ({ conditionId }) => conditionId === "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
            ),
          ).toHaveLength(1);
        },
      );
    }
  });

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
      expect(stdout.text).toContain("'--bundle' 'project-output'");
      expect(stdout.text).not.toContain("'--profile'");
      expect(stdout.text).not.toContain("'--template'");
      expect(stdout.text).not.toContain("'--css'");
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
        followUpRenderCommand: { args: string[]; display: string; executable: string };
        identities: Record<string, unknown>;
        handoff: {
          artifacts: { availability: string };
          render: { usability: string; command?: { args: string[] } };
        };
        input: { baseProfile: { basename: string; display: string; redacted: boolean } };
        project: { decisionMode: string; signalMode: string };
      };

      expect(report).toMatchObject({
        advisoryOnly: true,
        artifactType: "markdown-pdf-codex-project-report",
        project: {
          decisionMode: "deterministic",
          signalMode: "deterministic",
        },
      });
      expect(report).not.toHaveProperty("version");
      expect(report.identities).not.toHaveProperty("outputDirectory");
      expect(report.input.baseProfile).toEqual({
        display: "base.yml",
        basename: "base.yml",
        redacted: false,
      });
      expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
      expect(report.followUpRenderCommand).toMatchObject({
        executable: "cdx-chores",
        args: [
          "md",
          "to-pdf",
          "--input",
          "<input.md>",
          "--bundle",
          "project-output",
          "--output",
          "<output.pdf>",
        ],
      });
      expect(report.followUpRenderCommand.display).toContain("'md' 'to-pdf'");
      expect(report.followUpRenderCommand.display).toContain("'<input.md>'");
      expect(report.followUpRenderCommand.display).toContain("'<output.pdf>'");
      expect(report.followUpRenderCommand.display).not.toContain(fixtureDir);
      expect(report.handoff).toMatchObject({
        artifacts: { availability: "planned" },
        render: {
          usability: "planned",
          command: { args: report.followUpRenderCommand.args },
        },
      });
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

  test("keeps repo-relative external report references usable and private targets basename-only", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-external-report-reference",
      async (fixtureDir) => {
        await mkdir(join(fixtureDir, "reports"), { recursive: true });
        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          baseProfile: "base.yml",
          codexReportOutput: "reports/project.json",
          dryRun: true,
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

        const report = createMdPdfProjectCodexReportArtifact({
          outputPlan,
          profilePhase,
          runtime,
          signals,
          state,
          templatePhase,
          validation,
        });
        expect(report.files.find((file) => file.role === "project-report")).toMatchObject({
          path: "reports/project.json",
        });

        if (!outputPlan.report || outputPlan.report.location !== "external") {
          throw new Error("expected external Project report");
        }
        const privateReportPath = join(fixtureDir, "..", "private-client", "project.json");
        const privateReport = createMdPdfProjectCodexReportArtifact({
          outputPlan: {
            ...outputPlan,
            report: { location: "external", path: privateReportPath },
          },
          profilePhase,
          runtime,
          signals,
          state,
          templatePhase,
          validation,
        });
        expect(privateReport.files.find((file) => file.role === "project-report")).toMatchObject({
          path: "project.json",
        });
        expect(JSON.stringify(privateReport)).not.toContain(privateReportPath);
        expect(JSON.stringify(privateReport)).not.toContain("private-client");
      },
    );
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
      expect(stdout.text).toContain("Project artifacts: written");
      expect(stdout.text).toContain("Follow-up render usability: usable");
      expect(stderr.text).toContain("Wrote Markdown PDF project bundle:");
      expect(stderr.text).toContain("project-output");
      expectPrivacySafeReport(stdout.text, fixtureDir);
      expectPrivacySafeReport(stderr.text, fixtureDir);
      expect(await readFile(join(outputPath, "profile.yml"), "utf8")).toContain("md-pdf-profile-");
      const templateHtml = await readFile(join(outputPath, "template.html"), "utf8");
      expectManagedProjectTemplateRoles(templateHtml, { cover: true, metadataTitle: false });
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
      expect(await pathExists(join(outputPath, "assets", "cover.png"))).toBe(true);

      const completeBundle = await validateMdPdfProjectBundleCompleteness(outputPath);
      expect(completeBundle).toMatchObject({
        assets: [join(outputPath, "assets", "cover.png")],
        css: join(outputPath, "style.css"),
        profile: join(outputPath, "profile.yml"),
        reports: [reportPath],
        template: join(outputPath, "template.html"),
      });

      const reportText = await readFile(reportPath, "utf8");
      expectPrivacySafeReport(reportText, fixtureDir);
      const report = JSON.parse(reportText) as {
        handoff: {
          artifacts: { availability: string };
          profile: { bundlePath: string; id: string };
          render: { usability: string; command?: unknown };
        };
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
      expect(report.handoff).toMatchObject({
        profile: {
          id: "md-pdf-profile-20260704T080000Z-abc12345",
          bundlePath: "profile.yml",
        },
        artifacts: { availability: "written" },
        render: { usability: "usable" },
      });
    });
  });

  test("shows a usable written handoff after a successful bundle without a report", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-bundle-no-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        output: "project-output",
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project artifacts: written");
      expect(stdout.text).toContain("Follow-up render usability: usable");
      expect(stdout.text).not.toContain("Project artifacts: planned");
      expect(stdout.text).not.toContain("Follow-up render usability: planned");
      expect(stdout.text).not.toContain("Codex report:");
      expect(await pathExists(join(fixtureDir, "project-output", "profile.yml"))).toBe(true);
      const templatePath = join(fixtureDir, "project-output", "template.html");
      expect(await pathExists(templatePath)).toBe(true);
      expectManagedProjectTemplateRoles(await readFile(templatePath, "utf8"), {
        cover: false,
        metadataTitle: true,
      });
      expect(await pathExists(join(fixtureDir, "project-output", "style.css"))).toBe(true);
    });
  });

  test("reports successful profile-template validation without internal font ownership data", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-font-ownership-report",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");
        const reportPath = join(outputPath, "project.codex-report.json");
        const profileFontSentinel = "FULL_PROFILE_FONT_SENTINEL";
        const templateDecisionSentinel = "TEMPLATE_FONT_DECISION_SENTINEL";

        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "fonts:",
            "  body:",
            `    default: ${profileFontSentinel}`,
            "",
          ].join("\n"),
          "utf8",
        );

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        await actionMdPdfProjectCodex(runtime, {
          baseProfile: "base.yml",
          intent: "apply custom CSS",
          output: "project-output",
          keepCodexReport: true,
          profileCodexRunner: adaptedProfileRunner(),
          templateCodexRunner: stubTemplateRunner(
            adaptedTemplateResponse([
              {
                family: templateDecisionSentinel,
                key: "default",
                role: "body",
                source: "template-style",
                template_level: false,
              },
            ]),
          ),
          identityUidFactory: () => "abc12345",
        });

        const reportText = await readFile(reportPath, "utf8");
        const report = JSON.parse(reportText) as MarkdownPdfProjectCodexReportArtifact;
        expect(report.validationResults).toContainEqual({
          name: "profile-template-compatibility",
          status: "passed",
        });
        expect(report).not.toHaveProperty("fontOwnership");
        expect(report).not.toHaveProperty("ownedKeys");
        expect(report).not.toHaveProperty("normalizedProfile");
        expect(report.phases.profile).not.toHaveProperty("finalProfile");
        expect(report.phases.template).not.toHaveProperty("fontDecisions");
        expect(reportText).not.toContain('"fontOwnership"');
        expect(reportText).not.toContain('"ownedKeys"');
        expect(reportText).not.toContain('"normalizedProfile"');
        expect(reportText).not.toContain('"finalProfile"');
        expect(reportText).not.toContain('"fontDecisions"');
        expect(reportText).not.toContain(profileFontSentinel);
        expect(reportText).not.toContain(templateDecisionSentinel);
      },
    );
  });

  test("writes document-informed projects that suppress duplicate metadata titles", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-title-dedup", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(outputPath, "project.codex-report.json");

      await writeFile(
        join(fixtureDir, "cjk.md"),
        [
          "---",
          "title: CJK Font Smoke",
          "lang: en",
          "---",
          "",
          "# CJK Font Smoke",
          "",
          "This document checks mixed English, Japanese, Traditional Chinese, and code font handling.",
        ].join("\n"),
        "utf8",
      );

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(runtime, {
        input: "cjk.md",
        output: "project-output",
        keepCodexReport: true,
        profileCodexRunner: duplicateTitleProfileRunner(),
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project signal mode: codex-assisted");
      expect(stdout.text).toContain("Profile decision mode: adapted");
      expect(stdout.text).toContain("Template decision mode: deterministic");

      const profileText = await readFile(join(outputPath, "profile.yml"), "utf8");
      const templateText = await readFile(join(outputPath, "template.html"), "utf8");
      expect(profileText).toContain("titleBlock:");
      expect(profileText).toContain("metadataTitle: auto");
      expect(templateText).not.toContain('<header class="document-title">');
      expect(templateText).toContain("$body$");

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        phases: {
          profile: { decisionMode: string; signalMode: string };
          template: { decisionMode: string; signalMode: string };
        };
      };
      expect(report.phases.profile).toMatchObject({
        decisionMode: "adapted",
        signalMode: "document-informed",
      });
      expect(report.phases.template).toMatchObject({
        decisionMode: "deterministic",
        signalMode: "deterministic",
      });
    });
  });

  test("renders a project bundle equivalently through bundle and explicit inputs", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-render-feed", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "project-output");
      const pdfPath = join(fixtureDir, "rendered.pdf");
      const htmlPath = join(fixtureDir, "rendered.html");
      const renderedStyles: string[] = [];
      let renderedTemplate = "";

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(inputPath, "# Report\n\n```ts\nconst ok = true;\n```\n", "utf8");

      const { runtime: projectRuntime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(projectRuntime, {
        baseProfile: "base.yml",
        output: "project-output",
        identityUidFactory: () => "abc12345",
      });

      const { calls, runner } = createPdfRunner({
        html: "<html><body><pre><code>const ok = true;</code></pre></body></html>",
      });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            renderedTemplate = await readFile(templatePath, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((arg, index) => (arg === "--stylesheet" ? index : -1))
            .filter((index) => index >= 0);
          for (const index of stylesheetIndexes) {
            const stylesheetPath = args[index + 1];
            if (stylesheetPath) {
              renderedStyles.push(await readFile(stylesheetPath, "utf8"));
            }
          }
        }
        return runner(command, args, runnerOptions);
      };
      const {
        runtime: renderRuntime,
        stdout,
        expectNoStderr,
      } = createActionTestRuntime({
        cwd: fixtureDir,
      });

      await actionMdToPdf(renderRuntime, {
        input: "report.md",
        profile: "project-output/profile.yml",
        template: "project-output/template.html",
        css: "project-output/style.css",
        output: "rendered.pdf",
        htmlOutput: "rendered.html",
        runner: capturingRunner,
      });

      const weasyprintRender = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintRender?.args).toContain(join(outputPath, "style.css"));
      expect(await readFile(pdfPath, "utf8")).toContain("%PDF");
      expect(await readFile(htmlPath, "utf8")).toContain("<html>");
      expect(renderedTemplate).toContain("$body$");
      expect(renderedStyles.join("\n")).toContain(".cdx-code-line");
      expect(stdout.text).toContain("Wrote PDF: rendered.pdf");
      expectNoStderr();

      const bundlePdfPath = join(fixtureDir, "rendered-bundle.pdf");
      const bundleHtmlPath = join(fixtureDir, "rendered-bundle.html");
      const bundleStyles: string[] = [];
      let bundleTemplate = "";
      const { calls: bundleCalls, runner: bundleRunner } = createPdfRunner({
        html: "<html><body><pre><code>const ok = true;</code></pre></body></html>",
      });
      const bundleCapturingRunner: MarkdownPdfProcessRunner = async (
        command,
        args,
        runnerOptions,
      ) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            bundleTemplate = await readFile(templatePath, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((arg, index) => (arg === "--stylesheet" ? index : -1))
            .filter((index) => index >= 0);
          for (const index of stylesheetIndexes) {
            const stylesheetPath = args[index + 1];
            if (stylesheetPath) {
              bundleStyles.push(await readFile(stylesheetPath, "utf8"));
            }
          }
        }
        return bundleRunner(command, args, runnerOptions);
      };
      const {
        runtime: bundleRenderRuntime,
        stdout: bundleStdout,
        expectNoStderr: expectNoBundleStderr,
      } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdToPdf(bundleRenderRuntime, {
        input: "report.md",
        bundle: "project-output",
        output: "rendered-bundle.pdf",
        htmlOutput: "rendered-bundle.html",
        runner: bundleCapturingRunner,
      });

      const bundleWeasyprintRender = bundleCalls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(bundleWeasyprintRender?.args).toContain(join(outputPath, "style.css"));
      expect(await readFile(bundlePdfPath, "utf8")).toBe(await readFile(pdfPath, "utf8"));
      expect(await readFile(bundleHtmlPath, "utf8")).toBe(await readFile(htmlPath, "utf8"));
      expect(bundleTemplate).toBe(renderedTemplate);
      expect(bundleStyles).toEqual(renderedStyles);
      expect(bundleStdout.text).toContain("Resolved Markdown PDF bundle: project-output");
      expectNoBundleStderr();
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

  test("rejects symlinked managed asset sources without writing reports", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-asset-symlink-rejection",
      async (fixtureDir) => {
        const sourceDir = join(fixtureDir, "source");
        const coverPath = join(sourceDir, "cover.png");
        const targetPath = join(sourceDir, "target.png");
        const reportPath = join(fixtureDir, "project-output", "project.codex-report.json");

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
          keepCodexReport: true,
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
        const reportArtifact = createMdPdfProjectCodexReportArtifact({
          outputPlan,
          profilePhase,
          runtime,
          signals,
          state,
          templatePhase,
          validation,
        });
        expect(reportArtifact.handoff).toMatchObject({
          artifacts: { availability: "planned" },
          render: { usability: "planned" },
        });

        await rm(coverPath);
        await writeFile(targetPath, minimalPng(1200, 800));
        await symlink(targetPath, coverPath);

        const error = await expectCliError(
          () =>
            writeMdPdfProjectCodexBundle({
              outputPlan,
              profilePhase,
              reportArtifact,
              runtime,
              signals,
              state,
              templatePhase,
              validation,
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "managed asset assets/cover.png source is a symlink",
          },
        );

        expectPrivacySafeReport(error.message, fixtureDir);
        expect(await pathExists(outputPlan.profile.path)).toBe(true);
        expect(await pathExists(outputPlan.templateHtml.path)).toBe(true);
        expect(await pathExists(outputPlan.styleCss.path)).toBe(true);
        expect(await pathExists(join(outputPlan.outputDirectory, "assets", "cover.png"))).toBe(
          false,
        );
        expect(await pathExists(reportPath)).toBe(false);
        expect(reportArtifact.handoff).toMatchObject({
          artifacts: { availability: "planned" },
          render: { usability: "planned" },
        });
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
          keepCodexReport: true,
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
        expect(await pathExists(join(outputPath, "project.codex-report.json"))).toBe(false);
      },
    );
  });

  test("writes only an external public-safe report for a generated body-boundary failure", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-body-validation-no-output",
      async (fixtureDir) => {
        const fixture = await prepareWriteValidationFixture(fixtureDir, BASE_PROFILE);
        expect(fixture.state.inputPath).toBe(join(fixtureDir, "report.md"));
        expect(fixture.signals.shared.document.available).toBe(true);
        fixture.templatePhase.synthesis.templateHtml =
          fixture.templatePhase.synthesis.templateHtml.replace(
            'class="document-body"',
            'class="document-content"',
          );
        const validation = validateMdPdfProjectCodexProject({
          outputPlan: fixture.outputPlan,
          profilePhase: fixture.profilePhase,
          runtime: fixture.runtime,
          state: fixture.state,
          templatePhase: fixture.templatePhase,
        });

        expect(validation).toMatchObject({
          decisionMode: "no-usable-project",
          renderCommand: undefined,
        });
        expect(validation.results).toContainEqual(
          expect.objectContaining({
            name: "profile-body-page-number-compatibility",
            status: "failed",
          }),
        );
        expect(validation.diagnostics.conditions).toContainEqual(
          expect.objectContaining({
            conditionId: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
            context: { kind: "missing-body-boundary" },
            severity: "error",
          }),
        );

        await writeMdPdfProjectCodexBundle({ ...fixture, validation });

        const reportPath = join(fixtureDir, "project-validation-report.json");
        expect(await pathExists(reportPath)).toBe(true);
        expect(await pathExists(fixture.outputPlan.outputDirectory)).toBe(false);
        expect(await pathExists(fixture.outputPlan.profile.path)).toBe(false);
        expect(await pathExists(fixture.outputPlan.templateHtml.path)).toBe(false);
        expect(await pathExists(fixture.outputPlan.styleCss.path)).toBe(false);
        const reportText = await readFile(reportPath, "utf8");
        expectPrivacySafeReport(reportText, fixtureDir);
        const report = JSON.parse(reportText) as {
          files: Array<{ role: string }>;
          followUpRenderCommand?: unknown;
          handoff: {
            artifacts: { availability: string };
            diagnostics: Array<{ conditionId: string; message: string }>;
            render: { usability: string; command?: unknown };
          };
          validationResults: Array<{ message?: string; name: string; status: string }>;
        };
        expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
        expect(report.followUpRenderCommand).toBeUndefined();
        expect(report.handoff).toMatchObject({
          artifacts: { availability: "unavailable" },
          render: { usability: "unavailable" },
          diagnostics: [
            expect.objectContaining({ conditionId: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED" }),
          ],
        });
        expect(report.handoff.render).not.toHaveProperty("command");
        expect(report.validationResults).toContainEqual({
          message:
            "The generated Project Template requires exactly one .document-body element containing the single live $body$ insertion point (found missing-hook).",
          name: "profile-body-page-number-compatibility",
          status: "failed",
        });
      },
    );
  });

  test("writes no output for Template page-counter ownership failure without a requested report", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-css-validation-no-output",
      async (fixtureDir) => {
        const fixture = await prepareWriteValidationFixture(fixtureDir, BASE_PROFILE, {
          report: false,
        });
        expect(fixture.state.inputPath).toBe(join(fixtureDir, "report.md"));
        expect(fixture.signals.shared.document.available).toBe(true);
        fixture.templatePhase.synthesis.styleCss +=
          "\n@page { @bottom-center { content: counter(page); } }\n";
        const validation = validateMdPdfProjectCodexProject({
          outputPlan: fixture.outputPlan,
          profilePhase: fixture.profilePhase,
          runtime: fixture.runtime,
          state: fixture.state,
          templatePhase: fixture.templatePhase,
        });

        expect(validation.decisionMode).toBe("no-usable-project");
        expect(validation.renderCommand).toBeUndefined();
        expect(validation.results).toContainEqual(
          expect.objectContaining({
            name: "template-page-number-css-ownership",
            status: "failed",
          }),
        );

        await writeMdPdfProjectCodexBundle({ ...fixture, validation });

        expect(await pathExists(fixture.outputPlan.outputDirectory)).toBe(false);
        expect(await pathExists(fixture.outputPlan.profile.path)).toBe(false);
        expect(await pathExists(fixture.outputPlan.templateHtml.path)).toBe(false);
        expect(await pathExists(fixture.outputPlan.styleCss.path)).toBe(false);
        expect(await pathExists(join(fixtureDir, "project-validation-report.json"))).toBe(false);
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
        handoff: {
          artifacts: { availability: string };
          render: { usability: string; command?: unknown };
        };
        project: { decisionMode: string; fallbackReason: string };
      };
      expect(report.project).toMatchObject({
        decisionMode: "no-usable-project",
        fallbackReason: reason,
      });
      expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
      expect(report.followUpRenderCommand).toBeUndefined();
      expect(report.handoff).toMatchObject({
        artifacts: { availability: "unavailable" },
        render: { usability: "unavailable" },
      });
      expect(report.handoff.render).not.toHaveProperty("command");
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
          followUpRenderCommand?: unknown;
          handoff: {
            artifacts: { availability: string };
            render: { usability: string; command?: unknown };
          };
          project: { decisionMode: string; fallbackReason: string };
        };
        expect(report.project).toMatchObject({
          decisionMode: "no-usable-project",
          fallbackReason: reason,
        });
        expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
        expect(report.followUpRenderCommand).toBeUndefined();
        expect(report.handoff).toMatchObject({
          artifacts: { availability: "unavailable" },
          render: { usability: "unavailable" },
        });
        expect(report.handoff.render).not.toHaveProperty("command");
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
                noUsableTemplateResponse(TERMINAL_CONTROL_DIAGNOSTIC_TEXT),
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
        expect(error.message).not.toContain("\u001B");
        expect(error.message).not.toContain("\u0007");
        expect(error.message).toContain("\\u001b");
        expect(error.message).toContain("\\u0007");
        expect(stdout.text).toContain("Fallback reason:");
        expect(stdout.text).toContain("Unsupported direction:");
        expect(stdout.text).toContain("[redacted-path]");
        expect(stdout.text).toContain("[redacted-url]");
        expect(stdout.text).toContain("[redacted-host]");
        expect(stdout.text).not.toContain("\u001B");
        expect(stdout.text).not.toContain("\u0007");
        expect(stdout.text).toContain("\\u001b");
        expect(stdout.text).toContain("\\u0007");
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
          diagnostics: {
            conditions: [
              {
                conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
                severity: "warning",
                context: {
                  kind: "occupied-page-number-slot",
                  position: "top-center",
                  area: "header",
                  slot: "center",
                },
                message: SENSITIVE_DIAGNOSTIC_TEXT,
              },
              {
                conditionId: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
                severity: "warning",
                context: {
                  kind: "legacy-pages-token-migration",
                  countFrom: "body",
                  declaredRevision: 2,
                },
                message: "Legacy pages token needs migration guidance.",
              },
              {
                conditionId: "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK",
                severity: "warning",
                context: {
                  kind: "legacy-body-visibility-fallback",
                  bodyBoundary: "legacy-document-origin-fallback",
                },
                message: "Legacy body visibility fallback applies.",
              },
            ],
          },
          fallbackReason: SENSITIVE_DIAGNOSTIC_TEXT,
          renderCommand: {
            executable: "cdx-chores",
            args: [SENSITIVE_DIAGNOSTIC_TEXT],
            display: SENSITIVE_DIAGNOSTIC_TEXT,
          },
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
      expectRedactedReportText(report.handoff.diagnostics[0]?.message ?? "");
      expect(report.handoff.diagnostics.map((diagnostic) => diagnostic.conditionId)).toEqual([
        "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
        "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
        "MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_FALLBACK",
      ]);
      expect(report.handoff.render).toMatchObject({
        usability: "planned",
        command: {
          executable: "cdx-chores",
          args: [
            "md",
            "to-pdf",
            "--input",
            "<input.md>",
            "--bundle",
            "project-output",
            "--output",
            "<output.pdf>",
          ],
        },
      });
      expect(JSON.stringify(report.handoff.render)).not.toContain(SENSITIVE_DIAGNOSTIC_TEXT);
      expectPrivacySafeReport(JSON.stringify(report), fixtureDir);

      await writeMdPdfProjectCodexReportIfRequested({
        outputPlan,
        profilePhase,
        runtime,
        signals,
        state,
        templatePhase,
        validation,
      });
      if (!outputPlan.report) {
        throw new Error("expected report-only output plan");
      }
      const reportOnlyArtifact = JSON.parse(await readFile(outputPlan.report.path, "utf8")) as {
        files: Array<{ role: string }>;
        handoff: {
          artifacts: { availability: string };
          render: { usability: string; command?: unknown };
        };
      };
      expect(reportOnlyArtifact.files.map((file) => file.role)).toEqual(["project-report"]);
      expect(reportOnlyArtifact.handoff).toMatchObject({
        artifacts: { availability: "planned" },
        render: { usability: "planned" },
      });
      expect(reportOnlyArtifact.handoff.render).toHaveProperty("command");
      expect(await pathExists(outputPlan.profile.path)).toBe(false);
      expect(await pathExists(outputPlan.templateHtml.path)).toBe(false);
      expect(await pathExists(outputPlan.styleCss.path)).toBe(false);

      const occupiedSlotDiagnostic = {
        conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
        severity: "warning",
        context: {
          kind: "occupied-page-number-slot",
          position: "top-center",
          area: "header",
          slot: "center",
        },
        message: "Page-number slot occupied.",
      } as const;
      const rejectionCases: Array<{
        expected: string;
        label: string;
        validation: typeof validation;
      }> = [
        {
          label: "diagnostic root unknown key",
          expected: "Project handoff diagnostic contains unsupported fields.",
          validation: {
            ...validation,
            diagnostics: {
              conditions: [
                { ...occupiedSlotDiagnostic, rawDiagnostic: SENSITIVE_DIAGNOSTIC_TEXT } as never,
              ],
            },
          },
        },
        {
          label: "diagnostic context unknown key",
          expected: "Project handoff diagnostic context contains unsupported fields.",
          validation: {
            ...validation,
            diagnostics: {
              conditions: [
                {
                  ...occupiedSlotDiagnostic,
                  context: {
                    ...occupiedSlotDiagnostic.context,
                    rawDiagnostic: SENSITIVE_DIAGNOSTIC_TEXT,
                  },
                } as never,
              ],
            },
          },
        },
        {
          label: "unknown diagnostic condition",
          expected: "Project handoff diagnostic condition is unsupported.",
          validation: {
            ...validation,
            diagnostics: {
              conditions: [
                {
                  ...occupiedSlotDiagnostic,
                  conditionId: "MARKDOWN_PDF_PRIVATE_DIAGNOSTIC",
                } as never,
              ],
            },
          },
        },
        {
          label: "diagnostic severity mismatch",
          expected: "Project handoff diagnostic severity is unsupported.",
          validation: {
            ...validation,
            diagnostics: {
              conditions: [{ ...occupiedSlotDiagnostic, severity: "error" } as never],
            },
          },
        },
        {
          label: "slot and position mismatch",
          expected: "Project handoff diagnostic slot does not match its position.",
          validation: {
            ...validation,
            diagnostics: {
              conditions: [
                {
                  ...occupiedSlotDiagnostic,
                  context: { ...occupiedSlotDiagnostic.context, area: "footer" },
                },
              ],
            },
          },
        },
        {
          label: "unsupported migration revision",
          expected: "Project handoff declared Profile revision is unsupported.",
          validation: {
            ...validation,
            diagnostics: {
              conditions: [
                {
                  conditionId: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
                  severity: "warning",
                  context: {
                    kind: "legacy-pages-token-migration",
                    countFrom: "document",
                    declaredRevision: 3,
                  },
                  message: "Legacy pages token needs migration guidance.",
                } as never,
              ],
            },
          },
        },
        {
          label: "duplicate capability requesting field",
          expected: "Project handoff capability requesting fields are unsupported.",
          validation: {
            ...validation,
            capabilityRequirements: [
              {
                capabilityId: "pageNumbers.start",
                requestedBy: ["pageNumbers.start", "pageNumbers.start"],
                minimumVersion: "65.1",
              },
            ],
          },
        },
        {
          label: "unknown capability requesting field",
          expected: "Project handoff capability requesting fields are unsupported.",
          validation: {
            ...validation,
            capabilityRequirements: [
              {
                capabilityId: "pageNumbers.start",
                requestedBy: [SENSITIVE_DIAGNOSTIC_TEXT],
                minimumVersion: "65.1",
              } as never,
            ],
          },
        },
      ];

      for (const rejection of rejectionCases) {
        expect(
          () =>
            createMdPdfProjectCodexReportArtifact({
              outputPlan,
              profilePhase,
              runtime,
              signals,
              state,
              templatePhase,
              validation: rejection.validation,
            }),
          rejection.label,
        ).toThrow(rejection.expected);
      }
    });
  });
});
