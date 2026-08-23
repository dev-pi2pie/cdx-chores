import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../../src/adapters/codex/markdown-pdf-template";
import { suggestedMarkdownPdfCodexOutputPath } from "../../../src/cli/interactive/markdown/codex-service";
import {
  prepareMdPdfProjectCodex,
  rebindMdPdfProjectCodexPreparedArtifact,
  writePreparedMdPdfProjectCodexBundle,
} from "../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import {
  adaptedProfileResponse,
  adaptedTemplateResponse,
  BASE_PROFILE,
} from "./project-codex-prepared-fixtures";
import { minimalPng } from "./template-codex-fixtures";
import { pathExists } from "../support/path-fixtures";

describe("Markdown PDF Project Codex prepared handoff", () => {
  test("prepares once, rebinds the destination, and writes snapshotted content", async () => {
    await withTempFixtureDir("md-pdf-project-codex-prepared-rebind", async (fixtureDir) => {
      const originalCover = minimalPng(1200, 800);
      const changedCover = minimalPng(800, 1200);
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), originalCover);

      let profileCalls = 0;
      let templateCalls = 0;
      const profileCodexRunner: MarkdownPdfCodexProfileRunner = async () => {
        profileCalls += 1;
        return adaptedProfileResponse();
      };
      const templateCodexRunner: MarkdownPdfTemplateCodexRunner = async () => {
        templateCalls += 1;
        return adaptedTemplateResponse();
      };
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-22T01:02:03.000Z"),
      });

      const prepared = await prepareMdPdfProjectCodex(runtime, {
        input: "report.md",
        baseProfile: "base.yml",
        coverImage: "cover.png",
        intent: "Create a custom cover layout.",
        output: "first-project",
        keepCodexReport: true,
        dryRun: true,
        identityUidFactory: () => "abc12345",
        profileCodexRunner,
        templateCodexRunner,
      });
      const stableSnapshot = {
        identity: prepared.identity,
        layout: prepared.layout,
        profile: prepared.profilePhase.serializedProfile,
        template: prepared.templatePhase.synthesis.templateHtml,
        stylesheet: prepared.templatePhase.synthesis.styleCss,
        reportId: prepared.binding.reportArtifact.reportId,
      };

      const rebound = await rebindMdPdfProjectCodexPreparedArtifact({
        prepared,
        runtime,
        outputDirectory: "accepted-project",
        dryRun: false,
        report: { kind: "with-artifact" },
      });
      await writeFile(join(fixtureDir, "cover.png"), changedCover);
      await writePreparedMdPdfProjectCodexBundle(runtime, rebound);

      expect(profileCalls).toBe(1);
      expect(templateCalls).toBe(1);
      expect({
        identity: rebound.identity,
        layout: rebound.layout,
        profile: rebound.profilePhase.serializedProfile,
        template: rebound.templatePhase.synthesis.templateHtml,
        stylesheet: rebound.templatePhase.synthesis.styleCss,
        reportId: rebound.binding.reportArtifact.reportId,
      }).toEqual(stableSnapshot);
      expect(rebound.binding.outputPlan.outputDirectory).toBe(join(fixtureDir, "accepted-project"));
      expect(rebound.binding.outputPlan.identity).toMatchObject({
        projectBundleId: prepared.identity.projectBundleId,
        profileId: prepared.identity.profileId,
        templateBundleId: prepared.identity.templateBundleId,
        outputDirectory: join(fixtureDir, "accepted-project"),
      });
      expect(rebound.binding.validation.renderCommand?.args).toContain("accepted-project");
      expect(await readFile(join(fixtureDir, "accepted-project", "profile.yml"), "utf8")).toBe(
        stableSnapshot.profile,
      );
      expect(await readFile(join(fixtureDir, "accepted-project", "template.html"), "utf8")).toBe(
        stableSnapshot.template,
      );
      expect(await readFile(join(fixtureDir, "accepted-project", "style.css"), "utf8")).toBe(
        stableSnapshot.stylesheet,
      );
      expect(
        (await readFile(join(fixtureDir, "accepted-project", "assets", "cover.png"))).toString(
          "base64",
        ),
      ).toBe(originalCover.toString("base64"));
      const report = JSON.parse(
        await readFile(join(fixtureDir, "accepted-project", "project.codex-report.json"), "utf8"),
      ) as {
        followUpRenderCommand: { args: string[] };
        handoff: { artifacts: { availability: string }; render: { usability: string } };
        identities: Record<string, string>;
      };
      expect(report.identities).toEqual({
        projectBundleId: prepared.identity.projectBundleId,
        profileId: prepared.identity.profileId,
        templateBundleId: prepared.identity.templateBundleId,
        createdAt: prepared.identity.createdAt,
      });
      expect(report.followUpRenderCommand.args).toContain("accepted-project");
      expect(report.handoff).toMatchObject({
        artifacts: { availability: "written" },
        render: { usability: "usable" },
      });
      expect(rebound.binding.reportArtifact.handoff).toMatchObject({
        artifacts: { availability: "planned" },
        render: { usability: "planned" },
      });

      await expectCliError(
        () =>
          rebindMdPdfProjectCodexPreparedArtifact({
            prepared,
            runtime,
            outputDirectory: "accepted-project",
            dryRun: false,
            overwrite: false,
            report: { kind: "none" },
          }),
        { code: "OUTPUT_EXISTS", exitCode: 2 },
      );

      const preservedReport = await rebindMdPdfProjectCodexPreparedArtifact({
        prepared,
        runtime,
        outputDirectory: "project-with-preserved-report",
        dryRun: false,
      });
      await writePreparedMdPdfProjectCodexBundle(runtime, preservedReport);
      expect(preservedReport.binding.outputPlan.report).toEqual({
        bundlePath: "project.codex-report.json",
        location: "in-bundle",
        path: join(fixtureDir, "project-with-preserved-report", "project.codex-report.json"),
      });
      expect(
        await pathExists(
          join(fixtureDir, "project-with-preserved-report", "project.codex-report.json"),
        ),
      ).toBe(true);

      const withoutReport = await rebindMdPdfProjectCodexPreparedArtifact({
        prepared,
        runtime,
        outputDirectory: "project-without-report",
        dryRun: false,
        report: { kind: "none" },
      });
      await writePreparedMdPdfProjectCodexBundle(runtime, withoutReport);
      expect(withoutReport.binding.outputPlan.report).toBeUndefined();
      expect(withoutReport.binding.state.keepCodexReport).toBe(false);
      expect(
        await pathExists(join(fixtureDir, "project-without-report", "project.codex-report.json")),
      ).toBe(false);

      const withExternalReport = await rebindMdPdfProjectCodexPreparedArtifact({
        prepared,
        runtime,
        outputDirectory: "project-with-external-report",
        dryRun: false,
        overwrite: true,
        report: { kind: "external", path: "accepted-project-report.json" },
      });
      await writePreparedMdPdfProjectCodexBundle(runtime, withExternalReport);
      expect(withExternalReport.binding.state.overwrite).toBe(true);
      expect(withExternalReport.binding.outputPlan.report).toEqual({
        location: "external",
        path: join(fixtureDir, "accepted-project-report.json"),
      });
      expect(await pathExists(join(fixtureDir, "accepted-project-report.json"))).toBe(true);
      expect(
        await pathExists(
          join(fixtureDir, "project-with-external-report", "project.codex-report.json"),
        ),
      ).toBe(false);
      expect(profileCalls).toBe(1);
      expect(templateCalls).toBe(1);
    });
  });

  test("resolves a late generated-output collision without changing the prepared Project", async () => {
    await withTempFixtureDir("md-pdf-project-codex-prepared-late-output", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-22T08:30:00.000Z"),
      });
      const prepared = await prepareMdPdfProjectCodex(runtime, {
        input: "report.md",
        baseProfile: "base.yml",
        dryRun: true,
        identityUidFactory: () => "ba5e0002",
        profileCodexRunner: async () => adaptedProfileResponse(),
        templateCodexRunner: async () => adaptedTemplateResponse(),
      });
      const stable = {
        identity: prepared.identity,
        profile: prepared.profilePhase.serializedProfile,
        styleCss: prepared.templatePhase.synthesis.styleCss,
        templateHtml: prepared.templatePhase.synthesis.templateHtml,
      };
      await mkdir(prepared.binding.outputPlan.outputDirectory);

      const output = await suggestedMarkdownPdfCodexOutputPath({
        artifact: "project-bundle",
        prepared,
        setup: { artifact: "project-bundle", fontHints: [] },
      });
      const rebound = await rebindMdPdfProjectCodexPreparedArtifact({
        prepared,
        runtime,
        outputDirectory: output,
        dryRun: false,
      });

      expect(output).toBe(`${prepared.binding.outputPlan.outputDirectory}-1`);
      expect({
        identity: rebound.identity,
        profile: rebound.profilePhase.serializedProfile,
        styleCss: rebound.templatePhase.synthesis.styleCss,
        templateHtml: rebound.templatePhase.synthesis.templateHtml,
      }).toEqual(stable);
    });
  });
});
