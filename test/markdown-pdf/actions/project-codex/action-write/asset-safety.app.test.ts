import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  collectMdPdfProjectCodexSignals,
  createMdPdfProjectCodexReportArtifact,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  printMdPdfProjectCodexSummary,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  validateMdPdfProjectCodexProject,
  writeMdPdfProjectCodexBundle,
} from "../../../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../../helpers/cli-test-utils";
import { minimalPng } from "../../template-codex-fixtures";
import { pathExists } from "../../../support/path-fixtures";

import { BASE_PROFILE, expectPrivacySafeReport } from "../../project-codex-action-write-fixtures";

describe("cli action modules: md pdf-project codex action writes", () => {
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
});
