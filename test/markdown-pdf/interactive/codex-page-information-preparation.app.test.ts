import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { createMarkdownPdfPageInformationPreparationSession } from "../../../src/cli/interactive/markdown/codex-page-information-preparation";
import {
  bindMarkdownPdfCodexCandidate,
  writeBoundMarkdownPdfCodexCandidate,
} from "../../../src/cli/interactive/markdown/codex-service";
import { readMarkdownPdfProfileFile } from "../../../src/cli/markdown-pdf/profile";
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
          const output = artifact === "profile" ? "accepted-profile.yml" : "accepted-project";
          const bound = await bindMarkdownPdfCodexCandidate(runtime, result.candidate, {
            output,
            overwrite: false,
            report: { kind: "none" },
          });
          await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
          const profilePath = join(
            fixtureDir,
            artifact === "profile" ? output : `${output}/profile.yml`,
          );
          const saved = await readMarkdownPdfProfileFile(profilePath);
          expect(saved.pageNumbers).toMatchObject({
            enabled: true,
            scope: "body",
            countFrom: "body",
            format: " Exact {page} / {pages} ",
            position: "bottom-center",
          });
          expect(saved.header).toMatchObject({ left: "Exact {title}" });
          if (artifact === "project-bundle" && result.candidate.artifact === "project-bundle") {
            expect(await readFile(profilePath, "utf8")).toBe(
              result.candidate.prepared.profilePhase.serializedProfile,
            );
            expect(result.candidate.prepared.profilePhase.finalProfile).toMatchObject(saved);
          }
        }
      });
    },
  );

  test.each([
    {
      name: "model-selected number over explicit text",
      pageInformation: {
        repeatingContent: {
          enabled: true,
          selected: ["top-left"],
          text: { "top-left": "Exact text" },
        },
      },
      patches: [
        { op: "replace", path: "/pageNumbers/enabled", value: true },
        { op: "replace", path: "/pageNumbers/position", value: "top-left" },
      ],
      source: "explicit",
    },
    {
      name: "model-selected text under explicit number",
      pageInformation: { pageNumbers: pageInformation.pageNumbers },
      patches: [{ op: "replace", path: "/footer/center", value: "Model text" }],
      source: "candidate",
    },
  ] as const)(
    "returns $name to revision",
    async ({ pageInformation: answers, patches, source }) => {
      await withTempFixtureDir("md-pdf-interactive-model-conflict", async (fixtureDir) => {
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        let modelCalls = 0;
        const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
          confirmRequest: async () => true,
          internalProfileCodexRunner: async () => {
            modelCalls += 1;
            return JSON.stringify({
              decision_mode: "adapted",
              selected_candidate_id: "default",
              accepted_patches: patches,
              accepted_font_patches: [],
              reasoning: "Choose the requested layout.",
              warnings: [],
              fallback_reason: "",
              unmatched_directions: [],
            });
          },
        });
        const result = await session.prepare({
          artifact: "profile",
          fontHints: [],
          intent: "Use a report layout",
          pageInformation: answers as MarkdownPdfCodexSetup["pageInformation"],
        });
        expect(modelCalls).toBe(1);
        expect(result).toMatchObject({ kind: "needs-revision", conflict: { source } });
      });
    },
  );

  test.each(["profile", "project-bundle"] as const)(
    "%s returns a late occupied-slot conflict before acceptance or Template work",
    async (artifact) => {
      await withTempFixtureDir(
        `md-pdf-interactive-late-conflict-${artifact}`,
        async (fixtureDir) => {
          await writeFile(
            join(fixtureDir, "base.yml"),
            `${BASE_PROFILE}pageNumbers:\n  enabled: true\n  position: bottom-center\nfooter:\n  center: Occupied\n`,
            "utf8",
          );
          const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
          let templateCalls = 0;
          const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
            internalTemplateCodexRunner: async () => {
              templateCalls += 1;
              throw new Error("Unexpected Template request");
            },
          });
          const setup: MarkdownPdfCodexSetup = {
            artifact,
            baseProfile: "base.yml",
            fontHints: [],
            pageInformation: { pageNumbers: pageInformation.pageNumbers },
          };
          const conflict = await session.prepare(setup);
          expect(conflict).toMatchObject({
            kind: "needs-revision",
            conflict: { position: "bottom-center", text: "Occupied", source: "candidate" },
          });
          expect(templateCalls).toBe(0);

          const revised = await session.prepare({
            ...setup,
            pageInformation: {
              ...setup.pageInformation,
              occupiedNumberSlot: {
                position: "bottom-center",
                choice: "retain",
                conflictingText: "Occupied",
              },
            },
          });
          expect(revised.kind).toBe("prepared");
          if (revised.kind === "prepared") {
            const final =
              revised.candidate.artifact === "profile"
                ? revised.candidate.prepared.kind === "profile"
                  ? revised.candidate.prepared.finalProfile
                  : undefined
                : revised.candidate.artifact === "project-bundle"
                  ? revised.candidate.prepared.profilePhase.finalProfile
                  : undefined;
            expect(final?.footer).toMatchObject({ center: "Occupied" });
          }
        },
      );
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
      if (result.kind === "prepared" && result.candidate.artifact === "profile") {
        const bound = await bindMarkdownPdfCodexCandidate(runtime, result.candidate, {
          output: "accepted-profile.json",
          overwrite: false,
          report: { kind: "none" },
        });
        await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
        const saved = await readMarkdownPdfProfileFile(join(fixtureDir, "accepted-profile.json"));
        expect(saved.pageNumbers).toMatchObject({ format: " Exact {page} / {pages} " });
        expect(saved.header).toMatchObject({ left: "Exact {title}" });
      }
    });
  });

  test("mixed Project setup obtains consent before either model phase and reports actual modes", async () => {
    await withTempFixtureDir("md-pdf-interactive-page-project-mixed", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        `${BASE_PROFILE}fonts:\n  pageChrome:\n    default: Example Serif\nfooter:\n  style:\n    color: '#123456'\n`,
        "utf8",
      );
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
        fontHints: ["Page headers and footers: Example Serif"],
        intent: "Create a cover-led project.",
        pageInformation,
        sample: "report.md",
      });
      expect(result.kind).toBe("prepared");
      expect(events).toEqual(["consent", "profile", "template"]);
      expect(stderr.text).toContain("Profile phase:");
      expect(stderr.text).toContain("Template phase:");
      if (result.kind === "prepared" && result.candidate.artifact === "project-bundle") {
        expect(result.candidate.prepared.profilePhase.finalProfile.fonts).toMatchObject({
          pageChrome: { default: "Example Serif" },
        });
        expect(result.candidate.prepared.profilePhase.finalProfile.footer).toMatchObject({
          style: { color: "#123456" },
        });
      }
    });
  });
});
