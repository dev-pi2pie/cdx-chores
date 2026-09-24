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
import {
  MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE,
  type MarkdownPdfProjectCodexReportArtifact,
} from "../../../../src/cli/markdown-pdf/project-codex/types-report";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { BASE_PROFILE } from "./prepared-fixtures";

const PAGE_LABEL = "PRIVATE_PAGE_LABEL_45e";
const HEADER_TEXT = "PRIVATE_HEADER_TEXT_45e";
const FOOTER_TEXT = "PRIVATE_FOOTER_TEXT_45e";
const MODEL_ECHO = "PRIVATE_MODEL_ECHO_45e";
const INDEPENDENT_INTENT = "formal report with tables";
const INDEPENDENT_FONT_HINT = "prefer Source Serif 4";

describe("Project Codex page-information diagnostic report", () => {
  test("keeps the existing serialization for a report without explicit page information", () => {
    const report = {
      artifactType: MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE,
      project: { fallbackReason: "ordinary project result" },
    } as unknown as MarkdownPdfProjectCodexReportArtifact;
    expect(serializeMdPdfProjectCodexReportArtifact(report)).toBe(
      `${JSON.stringify(report, null, 2)}\n`,
    );
  });

  test("projects a persisted copy and preserves original in-memory review details", () => {
    const pageInformation = createMarkdownPdfCodexReportPageInformation({
      pageInformation: {
        pageNumbers: {
          enabled: true,
          position: "top-right",
          format: PAGE_LABEL,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
        },
        repeatingContent: {
          enabled: true,
          selected: ["top-right", "bottom-left"],
          text: { "top-right": HEADER_TEXT, "bottom-left": FOOTER_TEXT },
        },
      },
      finalProfile: {
        pageNumbers: {
          enabled: true,
          position: "top-right",
          format: PAGE_LABEL,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
        },
        header: { right: HEADER_TEXT },
        footer: { left: FOOTER_TEXT },
      },
      modelCallAttempted: true,
    });
    const report = {
      artifactType: MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE,
      advisoryOnly: true,
      reportId: "report-id",
      generatedAt: "2026-09-23T00:00:00.000Z",
      futureResultField: MODEL_ECHO,
      identities: {
        projectBundleId: "project-id",
        profileId: "profile-id",
        templateBundleId: "template-id",
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      pageInformation,
      project: {
        signalMode: "base-profile-only",
        decisionMode: "adapted",
        fallbackReason: MODEL_ECHO,
        futureResultField: MODEL_ECHO,
      },
      phases: {
        profile: {
          phase: "profile",
          signalMode: "hint-only",
          decisionMode: "adapted",
          fallbackReason: MODEL_ECHO,
          warnings: [MODEL_ECHO],
          futureResultField: MODEL_ECHO,
        },
        template: {
          phase: "template",
          signalMode: "deterministic",
          decisionMode: "adapted",
          fallbackReason: MODEL_ECHO,
          warnings: [MODEL_ECHO],
          futureResultField: MODEL_ECHO,
        },
      },
      input: {
        intent: INDEPENDENT_INTENT,
        fontHints: [INDEPENDENT_FONT_HINT],
        futureResultField: MODEL_ECHO,
      },
      signals: {
        document: {
          available: false,
          headingCount: 0,
          maxHeadingDepth: 0,
          maxTableColumns: 0,
          localAssetCount: 0,
          remoteAssetCount: 0,
          dataUriAssetCount: 0,
          scriptBuckets: {},
          textTruncated: false,
          futureResultField: MODEL_ECHO,
        },
        templateOwnedDirections: {
          document: [],
          intent: [],
          requiresCodex: false,
          futureResultField: MODEL_ECHO,
        },
      },
      unsupportedDirections: [MODEL_ECHO],
      files: [],
      managedAssets: [],
      validationResults: [
        { name: "profile", status: "failed", message: MODEL_ECHO, futureResultField: MODEL_ECHO },
      ],
      handoff: {
        profile: { id: "profile-id", bundlePath: "profile.yml", futureResultField: MODEL_ECHO },
        artifacts: { availability: "planned" },
        render: { usability: "unavailable" },
        diagnostics: [
          {
            conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
            severity: "warning",
            message: MODEL_ECHO,
            context: {
              kind: "occupied-page-number-slot",
              position: "top-right",
              area: "header",
              slot: "right",
            },
          },
        ],
        capabilityRequirements: [],
      },
    } as unknown as MarkdownPdfProjectCodexReportArtifact;

    const serialized = serializeMdPdfProjectCodexReportArtifact(report);
    const persisted = JSON.parse(serialized) as MarkdownPdfProjectCodexReportArtifact;
    expect(serialized).not.toContain(PAGE_LABEL);
    expect(serialized).not.toContain(HEADER_TEXT);
    expect(serialized).not.toContain(FOOTER_TEXT);
    expect(serialized).not.toContain(MODEL_ECHO);
    expect(persisted.input.intent).toBe(INDEPENDENT_INTENT);
    expect(persisted.input.fontHints).toEqual([INDEPENDENT_FONT_HINT]);
    expect(persisted.pageInformation).toMatchObject({
      modelResultDetails: "omitted",
      repeatingContent: {
        requested: { choice: "on", selectedPositions: ["top-right", "bottom-left"] },
        final: { storedPositions: ["top-right", "bottom-left"] },
      },
    });
    expect(persisted.diagnosticConditionIds).toEqual(["MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED"]);
    expect(persisted.handoff.diagnostics).toEqual([]);
    expect(persisted.phases.profile.warnings).toEqual([]);
    expect(persisted.validationResults).toEqual([{ name: "profile", status: "failed" }]);
    expect(report.handoff.diagnostics[0]?.message).toBe(MODEL_ECHO);
    expect(report.project.fallbackReason).toBe(MODEL_ECHO);
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
