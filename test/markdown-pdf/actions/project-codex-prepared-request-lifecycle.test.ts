import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { CodexProgressPresenter } from "../../../src/cli/actions/codex-progress";
import { prepareMdPdfProjectCodex } from "../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import {
  adaptedProfileResponse,
  adaptedTemplateResponse,
  BASE_PROFILE,
} from "./project-codex-prepared-fixtures";
import { minimalPng } from "./template-codex-fixtures";
import { pathExists } from "../support/path-fixtures";

describe("Markdown PDF Project Codex prepared request lifecycle", () => {
  test("reuses one timeout independently for profile, template, and repair requests", async () => {
    await withTempFixtureDir("md-pdf-project-codex-timeout", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const profileTimeouts: Array<number | undefined> = [];
      const templateTimeouts: Array<number | undefined> = [];
      let templateCallCount = 0;
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      const prepared = await prepareMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        coverImage: "cover.png",
        dryRun: true,
        input: "report.md",
        intent: "Create a cover-led project.",
        output: "project-output",
        profileCodexRunner: async (options) => {
          profileTimeouts.push(options.timeoutMs);
          return adaptedProfileResponse();
        },
        templateCodexRunner: async (options) => {
          templateTimeouts.push(options.timeoutMs);
          templateCallCount += 1;
          return templateCallCount === 1
            ? adaptedTemplateResponse().replace("assets/cover.png", "assets/other.png")
            : adaptedTemplateResponse();
        },
        timeoutMs: 120_000,
      });

      expect(prepared.binding.validation.decisionMode).toBe("adapted");
      expect(profileTimeouts).toEqual([120_000]);
      expect(templateTimeouts).toEqual([120_000, 120_000]);
    });
  });

  test("surfaces a structurally preserved project profile timeout", async () => {
    await withTempFixtureDir("md-pdf-project-codex-timeout-failure", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
      const timeoutError = new Error("private transport details");
      timeoutError.name = "TimeoutError";
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await expectCliError(
        () =>
          prepareMdPdfProjectCodex(runtime, {
            baseProfile: "base.yml",
            dryRun: true,
            input: "report.md",
            intent: "Create an article project.",
            output: "project-output",
            profileCodexRunner: async () => {
              throw timeoutError;
            },
            timeoutMs: 120_000,
          }),
        {
          code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
          exitCode: 1,
          messageIncludes:
            "Codex Markdown PDF project profile request timed out after the 2m per-attempt limit.",
        },
      );
      expect(await pathExists(join(fixtureDir, "project-output"))).toBe(false);
    });
  });

  test("stops injected progress as error when typed Project validation rejects cover incompatibility", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-progress-validation-error",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "cover:",
            "  enabled: true",
            "",
          ].join("\n"),
          "utf8",
        );
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
        const events: string[] = [];
        const codexProgressPresenter: CodexProgressPresenter = {
          start: (label) => events.push(`start:${label}`),
          update: (label) => events.push(`update:${label}`),
          stop: (status) => events.push(`stop:${status}`),
        };
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

        const prepared = await prepareMdPdfProjectCodex(runtime, {
          baseProfile: "base.yml",
          codexProgressPresenter,
          dryRun: true,
          input: "report.md",
          intent: "Create a custom layout.",
          output: "project-output",
          profileCodexRunner: async () => adaptedProfileResponse(),
          templateCodexRunner: async () => {
            const response = JSON.parse(adaptedTemplateResponse()) as {
              managed_assets: unknown[];
              slots: { cover: { enabled: boolean; style: string } };
            };
            response.slots.cover.enabled = false;
            response.slots.cover.style = "none";
            response.managed_assets = [];
            return JSON.stringify(response);
          },
        });

        expect(prepared.binding.validation.decisionMode).toBe("no-usable-project");
        expect(prepared.binding.validation.renderCommand).toBeUndefined();
        expect(prepared.binding.validation.results).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining("profile-owned text cover"),
            name: "profile-template-compatibility",
            status: "failed",
          }),
        );
        expect(prepared.binding.outputPlan.report).toBeUndefined();
        expect(prepared.binding.reportArtifact.handoff).toMatchObject({
          artifacts: { availability: "unavailable" },
          render: { usability: "unavailable" },
        });
        expect(prepared.binding.reportArtifact.handoff.render).not.toHaveProperty("command");
        expect(events).toEqual([
          "start:Requesting Codex Markdown PDF project profile recommendation",
          "update:Requesting Codex Markdown PDF project template recommendation",
          "stop:error",
        ]);
        expect(await pathExists(join(fixtureDir, "project-output"))).toBe(false);
      },
    );
  });

  test("projects shared diagnostics and capability requirements into a planned handoff", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-prepared-page-validation",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "header:",
            "  center: Existing page chrome",
            "pageNumbers:",
            "  enabled: true",
            "  scope: document",
            "  countFrom: document",
            "  start: 4",
            "  increment: 1",
            "  position: top-center",
            "  format: '{page}'",
            "",
          ].join("\n"),
          "utf8",
        );
        const filesBefore = await readdir(fixtureDir);
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

        const prepared = await prepareMdPdfProjectCodex(runtime, {
          baseProfile: "base.yml",
          dryRun: true,
          output: "project-output",
        });

        expect(prepared.binding.validation.diagnostics.conditions).toEqual([
          expect.objectContaining({
            conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
            context: expect.objectContaining({ area: "header", slot: "center" }),
          }),
        ]);
        expect(prepared.binding.validation.capabilityRequirements).toEqual([
          {
            capabilityId: "pageNumbers.start",
            minimumVersion: "65.1",
            requestedBy: ["pageNumbers.start"],
          },
          {
            capabilityId: "pageNumbers.scope.document",
            minimumVersion: "65.1",
            requestedBy: ["pageNumbers.scope"],
          },
        ]);
        const renderCommand = prepared.binding.validation.renderCommand;
        expect(renderCommand).toBeDefined();
        if (!renderCommand) {
          throw new Error("expected planned Project render command");
        }
        expect(prepared.binding.reportArtifact.handoff).toEqual({
          profile: {
            id: prepared.binding.outputPlan.identity.profileId,
            bundlePath: "profile.yml",
          },
          artifacts: { availability: "planned" },
          render: {
            usability: "planned",
            command: renderCommand,
          },
          diagnostics: prepared.binding.validation.diagnostics.conditions,
          capabilityRequirements: prepared.binding.validation.capabilityRequirements,
        });
        expect(prepared.binding.reportArtifact.handoff).not.toHaveProperty("pageNumbers");
        expect(prepared.binding.reportArtifact.handoff).not.toHaveProperty("renderer");
        expect(
          prepared.binding.reportArtifact.handoff.capabilityRequirements.map((requirement) =>
            Object.keys(requirement).sort(),
          ),
        ).toEqual([
          ["capabilityId", "minimumVersion", "requestedBy"],
          ["capabilityId", "minimumVersion", "requestedBy"],
        ]);
        expect(await readdir(fixtureDir)).toEqual(filesBefore);
        expect(await pathExists(join(fixtureDir, "project-output"))).toBe(false);
      },
    );
  });

  test("uses one injected presenter across the Profile and Template Codex stages", async () => {
    await withTempFixtureDir("md-pdf-project-codex-progress-shared", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const events: string[] = [];
      const codexProgressPresenter: CodexProgressPresenter = {
        start: (label) => events.push(`start:${label}`),
        update: (label) => events.push(`update:${label}`),
        stop: (status) => events.push(`stop:${status}`),
      };
      const { runtime, stderr } = createActionTestRuntime({ cwd: fixtureDir });

      await prepareMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        codexProgressPresenter,
        coverImage: "cover.png",
        dryRun: true,
        input: "report.md",
        intent: "Create a custom cover layout.",
        profileCodexRunner: async () => adaptedProfileResponse(),
        templateCodexRunner: async () => adaptedTemplateResponse(),
      });

      expect(events).toEqual([
        "start:Requesting Codex Markdown PDF project profile recommendation",
        "update:Requesting Codex Markdown PDF project template recommendation",
        "stop:done",
      ]);
      expect(stderr.text).not.toContain("Requesting Codex Markdown PDF project");
    });
  });

  test("stops a shared injected presenter when Project profile preparation fails", async () => {
    await withTempFixtureDir("md-pdf-project-codex-progress-error", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      const events: string[] = [];
      const codexProgressPresenter: CodexProgressPresenter = {
        start: (label) => events.push(`start:${label}`),
        update: (label) => events.push(`update:${label}`),
        stop: (status) => events.push(`stop:${status}`),
      };
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await expectCliError(
        () =>
          prepareMdPdfProjectCodex(runtime, {
            codexProgressPresenter,
            dryRun: true,
            input: "report.md",
            intent: "Create a custom layout.",
            profileCodexRunner: async () => {
              throw new Error("network unavailable");
            },
          }),
        { code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED", exitCode: 1 },
      );

      expect(events).toEqual([
        "start:Requesting Codex Markdown PDF project profile recommendation",
        "stop:error",
      ]);
    });
  });
});
