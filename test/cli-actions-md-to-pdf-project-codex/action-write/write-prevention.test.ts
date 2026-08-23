import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfProjectCodex } from "../../../src/cli/actions/markdown";
import {
  validateMdPdfProjectCodexProject,
  writeMdPdfProjectCodexBundle,
} from "../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { pathExists } from "../../markdown-pdf/support/path-fixtures";

import {
  BASE_PROFILE,
  adaptedProfileRunner,
  expectPrivacySafeReport,
  noUsableTemplateResponse,
  prepareWriteValidationFixture,
  stubTemplateRunner,
} from "../../markdown-pdf/actions/project-codex-action-write-fixtures";

describe("cli action modules: md pdf-project codex action writes", () => {
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
});
