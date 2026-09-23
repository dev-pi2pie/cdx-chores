import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { createMarkdownPdfCodexReportPageInformation } from "../../../../src/cli/markdown-pdf/codex-report/page-information";
import {
  collectMdPdfProjectCodexSignals,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  validateMdPdfProjectCodexProject,
} from "../../../../src/cli/markdown-pdf/project-codex";
import {
  createMdPdfProjectCodexReportArtifact,
  serializeMdPdfProjectCodexReportArtifact,
  writeMdPdfProjectCodexReportArtifact,
} from "../../../../src/cli/markdown-pdf/project-codex/report";
import type { MarkdownPdfProjectCodexReportArtifact } from "../../../../src/cli/markdown-pdf/project-codex/types-report";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { BASE_PROFILE } from "./prepared-fixtures";

const PRIVATE_TEXT = "PRIVATE_PAGE_TEXT_45e";

describe("Project Codex page-information diagnostic report", () => {
  test("projects a persisted copy and preserves original in-memory review details", () => {
    const pageInformation = createMarkdownPdfCodexReportPageInformation({
      pageInformation: { repeatingContent: { enabled: false } },
      finalProfile: { header: { left: PRIVATE_TEXT } },
      modelCallAttempted: true,
    });
    const report = {
      pageInformation,
      project: {
        signalMode: "base-profile-only",
        decisionMode: "adapted",
        fallbackReason: PRIVATE_TEXT,
      },
      phases: {
        profile: {
          phase: "profile",
          signalMode: "hint-only",
          decisionMode: "adapted",
          fallbackReason: PRIVATE_TEXT,
          warnings: [PRIVATE_TEXT],
        },
        template: {
          phase: "template",
          signalMode: "deterministic",
          decisionMode: "adapted",
          fallbackReason: PRIVATE_TEXT,
          warnings: [PRIVATE_TEXT],
        },
      },
      unsupportedDirections: [PRIVATE_TEXT],
      validationResults: [{ name: "profile", status: "failed", message: PRIVATE_TEXT }],
      handoff: {
        diagnostics: [
          {
            conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
            severity: "warning",
            message: PRIVATE_TEXT,
            context: {
              kind: "occupied-page-number-slot",
              position: "top-right",
              area: "header",
              slot: "right",
            },
          },
        ],
      },
    } as unknown as MarkdownPdfProjectCodexReportArtifact;

    const serialized = serializeMdPdfProjectCodexReportArtifact(report);
    const persisted = JSON.parse(serialized) as MarkdownPdfProjectCodexReportArtifact;
    expect(serialized).not.toContain(PRIVATE_TEXT);
    expect(persisted.pageInformation).toMatchObject({
      modelResultDetails: "omitted",
      repeatingContent: {
        requested: { choice: "off" },
        final: { storedPositions: ["top-left"] },
      },
    });
    expect(persisted.diagnosticConditionIds).toEqual(["MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED"]);
    expect(persisted.handoff.diagnostics).toEqual([]);
    expect(persisted.phases.profile.warnings).toEqual([]);
    expect(persisted.validationResults).toEqual([{ name: "profile", status: "failed" }]);
    expect(report.handoff.diagnostics[0]?.message).toBe(PRIVATE_TEXT);
    expect(report.project.fallbackReason).toBe(PRIVATE_TEXT);
  });

  test("writes metadata for a deterministic Project without changing its in-memory report", async () => {
    await withTempFixtureDir("md-pdf-project-page-info-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-09-23T00:00:00.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "report.json",
        dryRun: true,
        output: "project-output",
      });
      const signals = await collectMdPdfProjectCodexSignals(runtime, state, {
        pageNumbers: { enabled: false },
      });
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
      const reportArtifact = createMdPdfProjectCodexReportArtifact({
        outputPlan,
        profilePhase,
        runtime,
        signals,
        state,
        templatePhase,
        validation,
      });
      expect(reportArtifact.pageInformation?.modelResultDetails).toBe("not-requested");
      const missingMetadata = { ...reportArtifact };
      delete missingMetadata.pageInformation;
      await expect(
        writeMdPdfProjectCodexReportArtifact({
          outputPlan,
          profilePhase,
          reportArtifact: missingMetadata,
          runtime,
          signals,
          state,
          templatePhase,
          validation,
        }),
      ).rejects.toThrow("page-information metadata does not match");
      await expect(readFile(join(fixtureDir, "report.json"), "utf8")).rejects.toThrow();
      await writeMdPdfProjectCodexReportArtifact({
        outputPlan,
        profilePhase,
        reportArtifact,
        runtime,
        signals,
        state,
        templatePhase,
        validation,
      });
      const persisted = JSON.parse(
        await readFile(join(fixtureDir, "report.json"), "utf8"),
      ) as MarkdownPdfProjectCodexReportArtifact;
      expect(persisted.pageInformation?.pageNumbers.requested.choice).toBe("off");
      expect(persisted.pageInformation?.pageNumbers.final?.enabled).toBe(false);
      expect(persisted.handoff.diagnostics).toEqual([]);
      expect(reportArtifact.handoff.diagnostics).toEqual(validation.diagnostics.conditions);
    });
  });
});
