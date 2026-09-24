import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readMarkdownPdfCodexReportArtifact } from "../../../../src/cli/markdown-pdf/codex-report";
import { readMarkdownPdfProfileFile } from "../../../../src/cli/markdown-pdf/profile";

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
  writePreparedMdPdfProjectCodexBundle,
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
  test.each([true, false])(
    "saves inherited start zero and reports with numbering enabled=%s",
    async (enabled) => {
      await withTempFixtureDir("md-pdf-page-zero-report", async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          `pageNumbers:\n  enabled: ${enabled}\n  start: 0\nfooter:\n  left: Synthetic retained text\n`,
        );
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        const common = {
          baseProfile: "base.yml",
          internalPageInformation: {
            repeatingContent: { enabled: false, selected: [], text: {} },
          },
        };
        const profile = await prepareMarkdownPdfProfileCodex(runtime, {
          ...common,
          output: "profile.yml",
        });
        const destination = await bindMarkdownPdfProfileCodexDestination(runtime, profile, {
          report: { kind: "external", path: "profile-report.json" },
        });
        await commitPreparedMarkdownPdfProfileCodex({ runtime, prepared: profile, destination });
        const profileReport = await readMarkdownPdfCodexReportArtifact(
          join(fixtureDir, "profile-report.json"),
        );
        const project = await prepareMdPdfProjectCodex(runtime, {
          ...common,
          output: "project",
          codexReportOutput: "project-report.json",
        });
        await writePreparedMdPdfProjectCodexBundle(runtime, project);
        const projectReport = JSON.parse(
          await readFile(join(fixtureDir, "project-report.json"), "utf8"),
        );
        for (const report of [profileReport, projectReport]) {
          expect(report.pageInformation.pageNumbers).toMatchObject({
            requested: { choice: "unspecified" },
            final: { start: 0, enabled },
          });
          expect(report.pageInformation.repeatingContent).toMatchObject({
            requested: { choice: "off" },
            final: { storedPositions: [] },
          });
        }
        for (const path of ["profile.yml", "project/profile.yml"]) {
          const saved = await readMarkdownPdfProfileFile(join(fixtureDir, path));
          expect(saved.pageNumbers).toMatchObject({ start: 0, enabled });
          expect(saved.footer).toMatchObject({ left: "" });
        }
        expect(await readFile(join(fixtureDir, "project/template.html"), "utf8")).toContain(
          "$body$",
        );
        expect(await readFile(join(fixtureDir, "project/style.css"), "utf8")).toContain("@page");
      });
    },
  );

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

  test("allows optional reports for explicit page information in deterministic preparation", async () => {
    await withTempFixtureDir("md-pdf-page-signals-diagnostic-report", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const profile = await prepareMarkdownPdfProfileCodex(runtime, {
        internalPageInformation: pageInformation,
        keepCodexReport: true,
        output: "profile.yml",
      });
      expect(profile.kind).toBe("profile");
      const project = await prepareMdPdfProjectCodex(runtime, {
        codexReportOutput: "report.json",
        internalPageInformation: pageInformation,
        output: "project",
      });
      expect(project.binding.reportArtifact.pageInformation).toMatchObject({
        modelResultDetails: "not-requested",
        pageNumbers: { requested: { choice: "on", position: "bottom-right" } },
      });
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
      const withReport = await prepareMarkdownPdfProfileCodex(runtime, {
        internalPageInformation: offOnly,
        keepCodexReport: true,
        output: "off-report.yml",
        codexRunner: async () => {
          calls += 1;
          throw new Error("Unexpected model request");
        },
      });
      expect(withReport.kind).toBe("profile");
      expect(calls).toBe(0);
    });
  });

  test("writes safe Profile report after a late report binding", async () => {
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
      const withArtifact = await bindMarkdownPdfProfileCodexDestination(runtime, prepared, {
        report: { kind: "with-artifact" },
      });
      expect(withArtifact.reportOutputPath).toBeDefined();
      const destination = await bindMarkdownPdfProfileCodexDestination(runtime, prepared, {
        report: { kind: "external", path: "late-report.json" },
      });
      await commitPreparedMarkdownPdfProfileCodex({ runtime, prepared, destination });
      const reportText = await readFile(join(fixtureDir, "late-report.json"), "utf8");
      expect(reportText).not.toContain(marker);
      expect(reportText).not.toContain(pageInformation.pageNumbers?.format);
      expect(reportText).not.toContain(pageInformation.repeatingContent?.text["top-left"]);
      expect(JSON.parse(reportText).pageInformation.modelResultDetails).toBe("omitted");
    });
  });

  test("fails before writing a Profile or requested report when page metadata is missing", async () => {
    await withTempFixtureDir("md-pdf-profile-page-missing-report-metadata", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        internalPageInformation: pageInformation,
        output: "profile.yml",
      });
      if (prepared.kind !== "profile") {
        throw new Error("Expected a prepared Profile.");
      }
      expect(prepared.hasExplicitPageInformation).toBe(true);
      expect(prepared.reportPayload.pageInformation).toBeDefined();
      const destination = await bindMarkdownPdfProfileCodexDestination(runtime, prepared, {
        report: { kind: "external", path: "report.json" },
      });
      expect(await readdir(fixtureDir)).toEqual([]);

      await expectCliError(
        () =>
          commitPreparedMarkdownPdfProfileCodex({
            destination,
            prepared: {
              ...prepared,
              reportPayload: { ...prepared.reportPayload, pageInformation: undefined },
            },
            runtime,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "diagnostic report metadata is missing",
        },
      );
      expect(await readdir(fixtureDir)).toEqual([]);
    });
  });

  test("writes safe Project report after a late report rebind", async () => {
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
            project_cover_intent: "unspecified",
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
      const rebound = await rebindMdPdfProjectCodexPreparedArtifact({
        prepared,
        runtime,
        outputDirectory: "late-project",
        report: { kind: "external", path: "late-project-report.json" },
      });
      await writePreparedMdPdfProjectCodexReportIfRequested(runtime, rebound);
      const reboundReport = await readFile(join(fixtureDir, "late-project-report.json"), "utf8");
      expect(reboundReport).not.toContain(marker);
      expect(reboundReport).not.toContain(pageInformation.pageNumbers?.format);
      expect(reboundReport).not.toContain(pageInformation.repeatingContent?.text["top-left"]);
      expect(JSON.parse(reboundReport).pageInformation.modelResultDetails).toBe("omitted");
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
      await writeMdPdfProjectCodexReportArtifact({
        outputPlan: forged.binding.outputPlan,
        profilePhase: forged.profilePhase,
        reportArtifact: forged.binding.reportArtifact,
        runtime,
        signals: forged.signals,
        state: forged.binding.state,
        templatePhase: forged.binding.templatePhase,
        validation: forged.binding.validation,
      });
      const directReport = await readFile(report.path, "utf8");
      expect(directReport).not.toContain(marker);
      expect(directReport).not.toContain(pageInformation.pageNumbers?.format);
      expect(directReport).not.toContain(pageInformation.repeatingContent?.text["top-left"]);
    });
  });
});
