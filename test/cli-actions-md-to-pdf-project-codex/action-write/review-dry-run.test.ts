import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfProjectCodex } from "../../../src/cli/actions/markdown";
import {
  createMdPdfProjectCodexReportArtifact,
  printMdPdfProjectCodexSummary,
  validateMdPdfProjectCodexProject,
  writeMdPdfProjectCodexReportIfRequested,
} from "../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { pathExists } from "../../cli-actions-md-to-pdf-template-codex/fixtures";

import {
  BASE_PROFILE,
  adaptedProfileRunner,
  expectPrivacySafeReport,
  prepareWriteValidationFixture,
} from "./fixtures";

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
});
