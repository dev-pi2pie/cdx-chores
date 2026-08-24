import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfProjectCodex } from "../../../src/cli/actions/markdown";
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
  writeMdPdfProjectCodexReportIfRequested,
  type MarkdownPdfProjectCodexReportArtifact,
} from "../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { pathExists } from "../../markdown-pdf/support/path-fixtures";

import {
  BASE_PROFILE,
  adaptedProfileRunner,
  expectPrivacySafeReport,
  noUsableTemplateResponse,
  stubTemplateRunner,
} from "../../markdown-pdf/actions/project-codex-action-write-fixtures";

const SENSITIVE_REPORT_TEXT =
  "Use /Users/alice/private/report.md, file:///Users/alice/private/report.md, ssh://host/private/report.md, smb://server/share/report.md, vscode://file/secrets/report.md, C:\\Users\\Alice\\report.md, \\\\server\\share\\report.md, ./secrets/client-report.md, ../drafts/notes.md, assets/internal-logo.png, https://example.test/private?token=abc, localhost:3000, 127.0.0.1:3000, 127.1:3000, 2130706433:3000, and [::1]:3000";

const SENSITIVE_DIAGNOSTIC_TEXT =
  "Rejected /Users/alice/private/style.css, file:///Users/alice/private/style.css, ssh://host/private/style.css, smb://server/share/style.css, vscode://file/secrets/style.css, C:\\Users\\Alice\\style.css, \\\\server\\share\\style.css, ./secrets/style.css, ../drafts/style.css, assets/internal-style.css, and https://example.test/private?token=abc from localhost:3000, 127.0.0.1:3000, 127.1:3000, 2130706433:3000, and [::1]:3000";
const TERMINAL_CONTROL_DIAGNOSTIC_TEXT = `${SENSITIVE_DIAGNOSTIC_TEXT} \u001B[31munsafe\u001B[0m \u0007bell`;

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
