import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { createMarkdownPdfPageInformationPreparationSession } from "../../../src/cli/interactive/markdown/codex-page-information-preparation";
import type { MarkdownPdfCodexSetup } from "../../../src/cli/interactive/markdown/codex-types";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import {
  adaptedProfileResponse,
  adaptedTemplateResponse,
  BASE_PROFILE,
} from "../actions/project-codex/prepared-fixtures";
import { minimalPng } from "../actions/template-codex/fixtures";

const pageInformation: NonNullable<MarkdownPdfCodexSetup["pageInformation"]> = {
  pageNumbers: {
    enabled: true,
    scope: "body",
    countFrom: "body",
    start: 1,
    increment: 1,
    position: "bottom-center",
    format: " Exact {page} / {pages} ",
  },
  repeatingContent: {
    enabled: true,
    selected: ["top-left"],
    text: { "top-left": "Exact {title}" },
  },
};

describe("internal Interactive page-information preparation", () => {
  test.each(["profile", "project-bundle"] as const)(
    "%s page-information-only path prepares without consent or model calls",
    async (artifact) => {
      await withTempFixtureDir(`md-pdf-interactive-page-only-${artifact}`, async (fixtureDir) => {
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        let consentCalls = 0;
        let modelCalls = 0;
        const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
          confirmRequest: async () => {
            consentCalls += 1;
            return true;
          },
          internalProfileCodexRunner: async () => {
            modelCalls += 1;
            throw new Error("Unexpected Profile model request");
          },
          internalTemplateCodexRunner: async () => {
            modelCalls += 1;
            throw new Error("Unexpected Template model request");
          },
        });
        const result = await session.prepare({ artifact, fontHints: [], pageInformation });
        expect(result.kind).toBe("prepared");
        expect(consentCalls).toBe(0);
        expect(modelCalls).toBe(0);
        if (result.kind === "prepared") {
          expect(result.plan.profileMode).toBe("deterministic");
          if (artifact === "project-bundle") {
            expect(result.plan.projectMode).toBe("deterministic");
          }
        }
      });
    },
  );

  test("mixed Profile setup obtains consent before its one request and forwards the model choice", async () => {
    await withTempFixtureDir("md-pdf-interactive-page-mixed", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const events: string[] = [];
      const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
        codexExecution: { model: "test-model", reasoningEffort: "high" },
        confirmRequest: async () => {
          events.push("consent");
          return true;
        },
        internalProfileCodexRunner: async (options) => {
          events.push("model");
          expect(options.codexExecution).toMatchObject({
            model: "test-model",
            reasoningEffort: "high",
          });
          expect(options.prompt).toContain('"format": " Exact {page} / {pages} "');
          expect(options.prompt).toContain('"top-left": "Exact {title}"');
          return JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "Use the chosen layout.",
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          });
        },
      });
      const result = await session.prepare({
        artifact: "profile",
        fontHints: [],
        intent: "Use a restrained layout",
        pageInformation,
      });
      expect(result.kind).toBe("prepared");
      expect(events).toEqual(["consent", "model"]);
    });
  });

  test("mixed Project setup obtains consent before either model phase and reports actual modes", async () => {
    await withTempFixtureDir("md-pdf-interactive-page-project-mixed", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const { runtime, stderr } = createActionTestRuntime({ cwd: fixtureDir });
      const events: string[] = [];
      const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
        codexExecution: { model: "test-model", reasoningEffort: "high" },
        confirmRequest: async () => {
          events.push("consent");
          return true;
        },
        internalProfileCodexRunner: async (options) => {
          events.push("profile");
          expect(options.prompt).toContain('"format": " Exact {page} / {pages} "');
          expect(options.codexExecution).toMatchObject({ model: "test-model" });
          return adaptedProfileResponse();
        },
        internalTemplateCodexRunner: async (options) => {
          events.push("template");
          expect(options.codexExecution).toMatchObject({ model: "test-model" });
          return adaptedTemplateResponse();
        },
      });
      const result = await session.prepare({
        artifact: "project-bundle",
        baseProfile: "base.yml",
        coverImage: "cover.png",
        fontHints: [],
        intent: "Create a cover-led project.",
        pageInformation,
        sample: "report.md",
      });
      expect(result.kind).toBe("prepared");
      expect(events).toEqual(["consent", "profile", "template"]);
      expect(stderr.text).toContain("Profile phase:");
      expect(stderr.text).toContain("Template phase:");
    });
  });
});
