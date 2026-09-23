import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  prepareMarkdownPdfProfileCodex,
  type MarkdownPdfCodexPageInformationInput,
} from "../../../../src/cli/markdown-pdf/profile-codex";
import { prepareMdPdfProjectCodex } from "../../../../src/cli/markdown-pdf/project-codex";
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
});
