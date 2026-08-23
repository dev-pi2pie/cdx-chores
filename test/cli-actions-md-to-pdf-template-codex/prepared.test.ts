import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfTemplateCodex } from "../../src/cli/actions/markdown";
import {
  prepareMdPdfTemplateCodex,
  rebindPreparedMdPdfTemplateCodexArtifact,
  writePreparedMdPdfTemplateCodexBundle,
} from "../../src/cli/markdown-pdf/template-codex";
import { suggestedMarkdownPdfCodexOutputPath } from "../../src/cli/interactive/markdown/codex-service";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { pathExists } from "../markdown-pdf/support/path-fixtures";
import { minimalPng } from "../markdown-pdf/actions/template-codex-fixtures";

describe("Markdown PDF prepared Template Codex services", () => {
  test("rebinds content and snapshotted assets with destination-time report and overwrite policy", async () => {
    await withTempFixtureDir("md-pdf-template-codex-prepared-policy", async (fixtureDir) => {
      const coverPath = join(fixtureDir, "cover.png");
      const acceptedCover = minimalPng(1200, 800);
      await writeFile(coverPath, acceptedCover);
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-22T07:00:00.000Z"),
      });
      const prepared = await prepareMdPdfTemplateCodex(runtime, {
        coverImage: "cover.png",
        dryRun: true,
        output: "preview-template",
        preset: "report",
        templateBundleIdFactory: () => "md-pdf-template-prepared-policy",
      });
      const accepted = {
        bundleId: prepared.bundleId,
        reportDecision: prepared.reportArtifact.decision,
        styleCss: prepared.synthesis.styleCss,
        templateHtml: prepared.synthesis.templateHtml,
      };

      await writeFile(coverPath, minimalPng(640, 480));
      const withArtifact = await rebindPreparedMdPdfTemplateCodexArtifact({
        outputDirectory: "accepted-template",
        prepared,
        report: { kind: "with-artifact" },
        runtime,
      });
      await writePreparedMdPdfTemplateCodexBundle({ prepared: withArtifact, runtime });

      expect(withArtifact.bundleId).toBe(accepted.bundleId);
      expect(withArtifact.synthesis.templateHtml).toBe(accepted.templateHtml);
      expect(withArtifact.synthesis.styleCss).toBe(accepted.styleCss);
      expect(withArtifact.reportArtifact.decision).toEqual(accepted.reportDecision);
      expect(withArtifact.outputPlan.report).toEqual({
        bundlePath: "template.codex-report.json",
        location: "in-bundle",
        path: join(fixtureDir, "accepted-template", "template.codex-report.json"),
      });
      expect(
        Buffer.compare(
          await readFile(join(fixtureDir, "accepted-template", "assets", "cover.png")),
          acceptedCover,
        ),
      ).toBe(0);

      await expectCliError(
        () =>
          rebindPreparedMdPdfTemplateCodexArtifact({
            outputDirectory: "accepted-template",
            overwrite: false,
            prepared,
            report: { kind: "none" },
            runtime,
          }),
        { code: "OUTPUT_EXISTS", exitCode: 2 },
      );
      const overwriteEnabled = await rebindPreparedMdPdfTemplateCodexArtifact({
        outputDirectory: "accepted-template",
        overwrite: true,
        prepared,
        report: { kind: "none" },
        runtime,
      });
      expect(overwriteEnabled.state.overwrite).toBe(true);
      expect(overwriteEnabled.outputPlan.report).toBeUndefined();

      const externalReport = await rebindPreparedMdPdfTemplateCodexArtifact({
        outputDirectory: "external-template",
        prepared,
        report: { kind: "external", path: "accepted-template-report.json" },
        runtime,
      });
      await writePreparedMdPdfTemplateCodexBundle({ prepared: externalReport, runtime });
      expect(externalReport.outputPlan.report).toEqual({
        location: "external",
        path: join(fixtureDir, "accepted-template-report.json"),
      });
      expect(
        await pathExists(join(fixtureDir, "external-template", "template.codex-report.json")),
      ).toBe(false);
      expect(await pathExists(join(fixtureDir, "accepted-template-report.json"))).toBe(true);
    });
  });

  test("can remove an initially planned report and keeps direct action output parity", async () => {
    await withTempFixtureDir("md-pdf-template-codex-prepared-direct-parity", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-22T07:30:00.000Z"),
      });
      const prepared = await prepareMdPdfTemplateCodex(runtime, {
        dryRun: true,
        keepCodexReport: true,
        output: "preview-template",
        preset: "report",
        templateBundleIdFactory: () => "md-pdf-template-direct-parity",
      });
      expect(prepared.outputPlan.report).toBeDefined();

      const reportPreserved = await rebindPreparedMdPdfTemplateCodexArtifact({
        outputDirectory: "prepared-template-with-report",
        prepared,
        runtime,
      });
      expect(reportPreserved.outputPlan.report).toEqual({
        bundlePath: "template.codex-report.json",
        location: "in-bundle",
        path: join(fixtureDir, "prepared-template-with-report", "template.codex-report.json"),
      });

      const rebound = await rebindPreparedMdPdfTemplateCodexArtifact({
        outputDirectory: "prepared-template",
        prepared,
        report: { kind: "none" },
        runtime,
      });
      await writePreparedMdPdfTemplateCodexBundle({ prepared: rebound, runtime });
      await actionMdPdfTemplateCodex(runtime, {
        output: "direct-template",
        preset: "report",
        templateBundleIdFactory: () => "md-pdf-template-direct-parity",
      });

      expect(rebound.outputPlan.report).toBeUndefined();
      expect(
        await pathExists(join(fixtureDir, "prepared-template", "template.codex-report.json")),
      ).toBe(false);
      expect(await readFile(join(fixtureDir, "prepared-template", "template.html"), "utf8")).toBe(
        await readFile(join(fixtureDir, "direct-template", "template.html"), "utf8"),
      );
      expect(await readFile(join(fixtureDir, "prepared-template", "style.css"), "utf8")).toBe(
        await readFile(join(fixtureDir, "direct-template", "style.css"), "utf8"),
      );
    });
  });

  test("resolves a late generated-output collision without changing the prepared Template", async () => {
    await withTempFixtureDir("md-pdf-template-codex-prepared-late-output", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-22T08:00:00.000Z"),
      });
      const prepared = await prepareMdPdfTemplateCodex(runtime, {
        dryRun: true,
        preset: "report",
        templateBundleIdFactory: () => "md-pdf-template-late-output",
      });
      const stable = {
        bundleId: prepared.bundleId,
        styleCss: prepared.synthesis.styleCss,
        templateHtml: prepared.synthesis.templateHtml,
      };
      await mkdir(prepared.outputPlan.outputDirectory);

      const output = await suggestedMarkdownPdfCodexOutputPath({
        artifact: "template-bundle",
        prepared,
        setup: { artifact: "template-bundle", fontHints: [] },
      });
      const rebound = await rebindPreparedMdPdfTemplateCodexArtifact({
        outputDirectory: output,
        prepared,
        runtime,
      });

      expect(output).toBe(`${prepared.outputPlan.outputDirectory}-1`);
      expect({
        bundleId: rebound.bundleId,
        styleCss: rebound.synthesis.styleCss,
        templateHtml: rebound.synthesis.templateHtml,
      }).toEqual(stable);
    });
  });
});
