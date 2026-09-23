import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  bindMarkdownPdfProfileCodexDestination,
  commitPreparedMarkdownPdfProfileCodex,
  prepareMarkdownPdfProfileCodex,
  type MarkdownPdfCodexPageInformationInput,
} from "../../../../src/cli/markdown-pdf/profile-codex";
import {
  prepareMdPdfProjectCodex,
  rebindMdPdfProjectCodexPreparedArtifact,
  writeMdPdfProjectCodexReportArtifact,
  writePreparedMdPdfProjectCodexReportIfRequested,
} from "../../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { adaptedProfileResponse, BASE_PROFILE } from "../project-codex/prepared-fixtures";

const pageInformation: MarkdownPdfCodexPageInformationInput = {
  pageNumbers: {
    enabled: true,
    position: "bottom-right",
    format: " Exact {page} of {pages} ",
    scope: "body",
    countFrom: "body",
    start: 1,
    increment: 1,
  },
  repeatingContent: {
    enabled: true,
    selected: ["top-left"],
    text: { "top-left": "Literal report heading" },
  },
};

describe("internal page-information helper signals", () => {
  test("Profile page information alone stays deterministic with and without a base", async () => {
    await withTempFixtureDir("md-pdf-profile-page-signals", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      let calls = 0;
      for (const baseProfile of [undefined, "base.yml"]) {
        const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
          ...(baseProfile ? { baseProfile } : {}),
          codexRunner: async () => {
            calls += 1;
            return adaptedProfileResponse();
          },
          internalPageInformation: pageInformation,
          output: baseProfile ? "with-base.yml" : "without-base.yml",
        });
        expect(prepared.kind).toBe("profile");
        if (prepared.kind === "profile") {
          expect(prepared.signalMode).toBe(
            baseProfile ? "base-only-deterministic" : "basic-default",
          );
        }
      }
      expect(calls).toBe(0);
    });
  });

  test("Profile mixed request receives exact structured text, while report request omits it", async () => {
    await withTempFixtureDir("md-pdf-profile-page-mixed", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      let prompt = "";
      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        codexRunner: async (options) => {
          prompt = options.prompt;
          return JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "Apply intent.",
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          });
        },
        intent: "Prefer a restrained layout",
        internalPageInformation: pageInformation,
        output: "profile.yml",
      });
      expect(prepared.kind).toBe("profile");
      expect(prompt).toContain('"format": " Exact {page} of {pages} "');
      expect(prompt).toContain('"top-left": "Literal report heading"');
      expect(JSON.stringify(prepared.reportPayload.request)).not.toContain(
        "Literal report heading",
      );
      expect(JSON.stringify(prepared.reportPayload.request)).not.toContain("Exact {page}");
    });
  });

  test("Project page information admits deterministic preparation and removal restores low signal", async () => {
    await withTempFixtureDir("md-pdf-project-page-signals", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      let calls = 0;
      for (const baseProfile of [undefined, "base.yml"]) {
        const prepared = await prepareMdPdfProjectCodex(runtime, {
          ...(baseProfile ? { baseProfile } : {}),
          internalPageInformation: pageInformation,
          output: baseProfile ? "with-base" : "without-base",
          profileCodexRunner: async () => {
            calls += 1;
            return adaptedProfileResponse();
          },
          templateCodexRunner: async () => {
            calls += 1;
            throw new Error("Unexpected Template model request");
          },
        });
        expect(prepared.signals.modes).toMatchObject({
          project: "deterministic",
          profile: baseProfile ? "base-only-deterministic" : "basic-default",
          template: baseProfile ? "base-profile-only" : "deterministic",
        });
      }
      expect(calls).toBe(0);
      await expectCliError(
        () =>
          prepareMdPdfProjectCodex(runtime, {
            internalPageInformation: {},
            output: "removed",
          }),
        { code: "MARKDOWN_PDF_PROJECT_LOW_SIGNAL", exitCode: 2 },
      );
      expect(calls).toBe(0);
    });
  });

  test("rejects optional reports for explicit page information before either helper prepares", async () => {
    await withTempFixtureDir("md-pdf-page-signals-no-diagnostic-report", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          prepareMarkdownPdfProfileCodex(runtime, {
            internalPageInformation: pageInformation,
            keepCodexReport: true,
            output: "profile.yml",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      await expectCliError(
        () =>
          prepareMdPdfProjectCodex(runtime, {
            codexReportOutput: "report.json",
            internalPageInformation: pageInformation,
            output: "project",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
    });
  });

  test("keeps explicit OFF distinct from omission and excludes inactive drafts", async () => {
    await withTempFixtureDir("md-pdf-page-signals-off-only", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const offOnly: MarkdownPdfCodexPageInformationInput = {
        pageNumbers: {
          enabled: false,
          position: "bottom-center",
          format: "INACTIVE_LABEL_MARKER",
          scope: "body",
          countFrom: "body",
          start: 0,
          increment: 2,
        },
        repeatingContent: {
          enabled: false,
          selected: ["top-left"],
          text: { "top-left": "INACTIVE_SLOT_MARKER" },
        },
      };
      let calls = 0;
      const profile = await prepareMarkdownPdfProfileCodex(runtime, {
        internalPageInformation: offOnly,
        output: "off-profile.yml",
        codexRunner: async () => {
          calls += 1;
          throw new Error("Unexpected Profile model request");
        },
      });
      expect(profile.kind).toBe("profile");
      expect(profile.hasExplicitPageInformation).toBe(true);
      expect(profile.reportPayload.request).not.toHaveProperty("pageInformation");
      expect(JSON.stringify(profile.reportPayload.request)).not.toContain("INACTIVE_");
      const project = await prepareMdPdfProjectCodex(runtime, {
        internalPageInformation: offOnly,
        output: "off-project",
        profileCodexRunner: async () => {
          calls += 1;
          throw new Error("Unexpected Project Profile model request");
        },
        templateCodexRunner: async () => {
          calls += 1;
          throw new Error("Unexpected Project Template model request");
        },
      });
      expect(project.signals.modes.project).toBe("deterministic");
      expect(project.signals.profile.pageInformation).toEqual({
        pageNumbers: { enabled: false },
        repeatingContent: { enabled: false },
      });
      expect(calls).toBe(0);
      await expectCliError(
        () =>
          prepareMarkdownPdfProfileCodex(runtime, {
            internalPageInformation: offOnly,
            keepCodexReport: true,
            output: "off-report.yml",
            codexRunner: async () => {
              calls += 1;
              throw new Error("Unexpected model request");
            },
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      expect(calls).toBe(0);
    });
  });

  test("rejects late Profile report bindings and forged report destinations before writing", async () => {
    await withTempFixtureDir("md-pdf-profile-page-late-report", async (fixtureDir) => {
      const marker = "MODEL_ECHO_MARKER";
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        intent: "Restrained layout",
        internalPageInformation: pageInformation,
        output: "profile.yml",
        codexRunner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: `Echo: ${marker}`,
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          }),
      });
      expect(prepared.kind).toBe("profile");
      expect(prepared.hasExplicitPageInformation).toBe(true);
      expect(JSON.stringify(prepared.reportPayload.result)).toContain(marker);
      await expectCliError(
        () =>
          bindMarkdownPdfProfileCodexDestination(runtime, prepared, {
            report: { kind: "with-artifact" },
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      await expectCliError(
        () =>
          bindMarkdownPdfProfileCodexDestination(runtime, prepared, {
            report: { kind: "external", path: "late-report.json" },
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      await expectCliError(
        () =>
          commitPreparedMarkdownPdfProfileCodex({
            runtime,
            prepared,
            destination: {
              displayOutputPath: "profile.yml",
              outputPath: join(fixtureDir, "profile.yml"),
              reportOutputPath: join(fixtureDir, "forged-report.json"),
            },
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      expect(await readdir(fixtureDir)).toEqual([]);
    });
  });

  test("rejects late Project report rebind and direct report writes", async () => {
    await withTempFixtureDir("md-pdf-project-page-late-report", async (fixtureDir) => {
      const marker = "PROJECT_MODEL_ECHO_MARKER";
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const prepared = await prepareMdPdfProjectCodex(runtime, {
        intent: "Restrained layout",
        internalPageInformation: pageInformation,
        output: "project",
        profileCodexRunner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: `Echo: ${marker}`,
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          }),
        templateCodexRunner: async () => {
          throw new Error("Unexpected Template model request");
        },
      });
      expect(JSON.stringify(prepared.profilePhase)).toContain(marker);
      await expectCliError(
        () =>
          rebindMdPdfProjectCodexPreparedArtifact({
            prepared,
            runtime,
            outputDirectory: "late-project",
            report: { kind: "with-artifact" },
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      const report = {
        location: "external" as const,
        path: join(fixtureDir, "forged-project-report.json"),
      };
      const forged = {
        ...prepared,
        binding: {
          ...prepared.binding,
          outputPlan: { ...prepared.binding.outputPlan, report },
        },
      };
      await expectCliError(() => writePreparedMdPdfProjectCodexReportIfRequested(runtime, forged), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "diagnostic reports",
      });
      await expectCliError(
        () =>
          writeMdPdfProjectCodexReportArtifact({
            outputPlan: forged.binding.outputPlan,
            profilePhase: forged.profilePhase,
            reportArtifact: forged.binding.reportArtifact,
            runtime,
            signals: forged.signals,
            state: forged.binding.state,
            templatePhase: forged.binding.templatePhase,
            validation: forged.binding.validation,
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "diagnostic reports" },
      );
      expect(await readdir(fixtureDir)).toEqual([]);
    });
  });
});
