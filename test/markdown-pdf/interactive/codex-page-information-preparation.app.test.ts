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
import type { MarkdownPdfCodexPageInformationPrompts } from "../../../src/cli/interactive/markdown/codex-page-information";
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
            report: { kind: "with-artifact" },
          });
          await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
          const reportPath =
            bound.artifact === "profile"
              ? bound.destination.reportOutputPath
              : bound.artifact === "project-bundle"
                ? bound.candidate.prepared.binding.outputPlan.report?.path
                : undefined;
          expect(reportPath).toBeDefined();
          const report = JSON.parse(await readFile(reportPath!, "utf8"));
          expect(report.pageInformation).toMatchObject({
            modelResultDetails: "not-requested",
            pageNumbers: {
              requested: { choice: "on", position: "bottom-center" },
              final: { enabled: true, position: "bottom-center" },
            },
            repeatingContent: {
              requested: { choice: "on", selectedPositions: ["top-left"] },
              final: { storedPositions: ["top-left"] },
            },
          });
          expect(JSON.stringify(report)).not.toContain("Exact {page} / {pages}");
          expect(JSON.stringify(report)).not.toContain("Exact {title}");
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

  test.each(["profile", "project-bundle"] as const)(
    "%s preserves reviewed retained text when Codex leaves the candidate slot empty",
    async (artifact) => {
      await withTempFixtureDir(`md-pdf-interactive-retained-${artifact}`, async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          `${BASE_PROFILE}footer:\n  center: Occupied\n`,
          "utf8",
        );
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
          confirmRequest: async () => true,
          internalProfileCodexRunner: async () =>
            JSON.stringify({
              ...(artifact === "project-bundle" ? { project_cover_intent: "unspecified" } : {}),
              decision_mode: "adapted",
              selected_candidate_id: artifact === "profile" ? "default" : "base-profile",
              accepted_patches:
                artifact === "profile"
                  ? []
                  : [{ op: "replace", path: "/footer/center", value: "" }],
              accepted_font_patches: [],
              reasoning: "Prepare the selected Profile.",
              warnings: [],
              fallback_reason: "",
              unmatched_directions: [],
            }),
        });
        const result = await session.prepare({
          artifact,
          baseProfile: "base.yml",
          fontHints: [],
          intent: "Use readable typography",
          pageInformation: {
            pageNumbers: pageInformation.pageNumbers,
            occupiedNumberSlot: {
              position: "bottom-center",
              choice: "retain",
              conflictingText: "Occupied",
            },
          },
        });
        expect(result.kind).toBe("prepared");
        if (result.kind === "prepared") {
          const final =
            result.candidate.artifact === "profile"
              ? result.candidate.prepared.kind === "profile"
                ? result.candidate.prepared.finalProfile
                : undefined
              : result.candidate.artifact === "project-bundle"
                ? result.candidate.prepared.profilePhase.finalProfile
                : undefined;
          expect(final?.footer).toMatchObject({ center: "Occupied" });
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

  test("revises retained model text when regeneration leaves its slot empty", async () => {
    await withTempFixtureDir("md-pdf-interactive-model-text-removed", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      let modelCalls = 0;
      const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
        confirmRequest: async () => true,
        internalProfileCodexRunner: async () => {
          modelCalls += 1;
          return JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches:
              modelCalls === 1
                ? [{ op: "replace", path: "/footer/center", value: "Model text" }]
                : [],
            accepted_font_patches: [],
            reasoning: "Use the selected Profile.",
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          });
        },
      });
      const setup: MarkdownPdfCodexSetup = {
        artifact: "profile",
        fontHints: [],
        intent: "Use a report layout",
        pageInformation: { pageNumbers: pageInformation.pageNumbers },
      };
      const first = await session.prepare(setup);
      expect(first).toMatchObject({
        kind: "needs-revision",
        conflict: { text: "Model text", candidateAbsent: false },
      });
      if (first.kind !== "needs-revision") throw new Error("Expected first revision");
      const prompts = {
        formalGuide: { clearOccupiedPageNumberPosition: async () => false },
      } as unknown as MarkdownPdfCodexPageInformationPrompts;
      const retained = await session.revise(setup, first.conflict, prompts);
      if (retained.kind !== "answers" || !retained.answers) {
        throw new Error("Expected retained answers");
      }
      expect(retained.answers.occupiedNumberSlot).toMatchObject({ source: "model" });
      const second = await session.prepare({ ...setup, pageInformation: retained.answers });
      expect(second).toMatchObject({
        kind: "needs-revision",
        conflict: { text: "Model text", candidateAbsent: true },
      });
      if (second.kind !== "needs-revision") throw new Error("Expected removal revision");
      const confirmed = await session.revise(
        { ...setup, pageInformation: retained.answers },
        second.conflict,
        prompts,
      );
      if (confirmed.kind !== "answers" || !confirmed.answers) {
        throw new Error("Expected confirmed answers");
      }
      expect(confirmed.answers.occupiedNumberSlot).toMatchObject({
        source: "model",
        candidateAbsentConfirmed: true,
      });
      const third = await session.prepare({ ...setup, pageInformation: confirmed.answers });
      expect(third.kind).toBe("prepared");
      if (third.kind === "prepared" && third.candidate.artifact === "profile") {
        expect(third.candidate.prepared.kind).toBe("profile");
        if (third.candidate.prepared.kind === "profile") {
          expect(third.candidate.prepared.finalProfile.footer).toMatchObject({
            center: "Model text",
          });
        }
      }
      expect(modelCalls).toBe(3);
    });
  });

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
          if (conflict.kind !== "needs-revision") throw new Error("Expected revision");
          const revision = await session.revise(setup, conflict.conflict, {
            formalGuide: { clearOccupiedPageNumberPosition: async () => false },
          } as unknown as MarkdownPdfCodexPageInformationPrompts);
          if (revision.kind !== "answers" || !revision.answers) {
            throw new Error("Expected revised answers");
          }
          const revised = await session.prepare({
            ...setup,
            pageInformation: revision.answers,
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
          await writeFile(
            join(fixtureDir, "base.yml"),
            `${BASE_PROFILE}pageNumbers:\n  enabled: true\n  position: bottom-center\nfooter:\n  center: Changed\n`,
            "utf8",
          );
          expect(
            await session.prepare({ ...setup, pageInformation: revision.answers }),
          ).toMatchObject({
            kind: "needs-revision",
            conflict: { position: "bottom-center", text: "Changed", source: "candidate" },
          });
          expect(templateCalls).toBe(0);
          await writeFile(
            join(fixtureDir, "base.yml"),
            `${BASE_PROFILE}pageNumbers:\n  enabled: true\n  position: bottom-center\nfooter:\n  center: ""\n`,
            "utf8",
          );
          const afterClear = await session.prepare({
            ...setup,
            pageInformation: revision.answers,
          });
          expect(afterClear.kind).toBe("prepared");
          if (afterClear.kind === "prepared") {
            const final =
              afterClear.candidate.artifact === "profile"
                ? afterClear.candidate.prepared.kind === "profile"
                  ? afterClear.candidate.prepared.finalProfile
                  : undefined
                : afterClear.candidate.artifact === "project-bundle"
                  ? afterClear.candidate.prepared.profilePhase.finalProfile
                  : undefined;
            expect(final?.footer).toMatchObject({ center: "" });
          }
        },
      );
    },
  );

  test("mixed Profile setup obtains consent before its one request and forwards the model choice", async () => {
    await withTempFixtureDir("md-pdf-interactive-page-mixed", async (fixtureDir) => {
      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });
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
            fallback_reason: "Echo\u202e\u2028 page text",
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
        expect(stdout.text).toContain("Fallback reason: Echo\\u202e\\u2028 page text");
        expect(stdout.text).not.toContain("\u202e");
        expect(stdout.text).not.toContain("\u2028");
        const saved = await readMarkdownPdfProfileFile(join(fixtureDir, "accepted-profile.json"));
        expect(saved.pageNumbers).toMatchObject({ format: " Exact {page} / {pages} " });
        expect(saved.header).toMatchObject({ left: "Exact {title}" });
      }
    });
  });

  test("exact answers override conflicting Codex Profile patches", async () => {
    await withTempFixtureDir("md-pdf-interactive-page-authority", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
        confirmRequest: async () => true,
        internalProfileCodexRunner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "default",
            accepted_patches: [
              { op: "replace", path: "/pageNumbers/format", value: "Model label" },
              { op: "replace", path: "/header/left", value: "Model header" },
              { op: "replace", path: "/footer/right", value: "Model footer" },
            ],
            accepted_font_patches: [],
            reasoning: "Use generated chrome.",
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          }),
      });
      const result = await session.prepare({
        artifact: "profile",
        fontHints: [],
        intent: "Use report chrome",
        pageInformation,
      });
      expect(result.kind).toBe("prepared");
      if (result.kind === "prepared" && result.candidate.artifact === "profile") {
        expect(result.candidate.prepared.kind).toBe("profile");
        if (result.candidate.prepared.kind === "profile") {
          expect(result.candidate.prepared.finalProfile.pageNumbers).toMatchObject({
            format: " Exact {page} / {pages} ",
          });
          expect(result.candidate.prepared.finalProfile.header).toMatchObject({
            left: "Exact {title}",
          });
          expect(result.candidate.prepared.finalProfile.footer).toMatchObject({ right: "" });
        }
      }
    });
  });

  test("Profile save escapes page text in terminal review while keeping saved text exact", async () => {
    await withTempFixtureDir("md-pdf-interactive-page-terminal-save", async (fixtureDir) => {
      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });
      const label = "Label\u0085\u202e\u2028 {page}";
      const header = "Header\u2029 exact";
      const session = createMarkdownPdfPageInformationPreparationSession(runtime);
      const result = await session.prepare({
        artifact: "profile",
        fontHints: [],
        pageInformation: {
          pageNumbers: { ...pageInformation.pageNumbers!, format: label },
          repeatingContent: {
            enabled: true,
            selected: ["top-left"],
            text: { "top-left": header },
          },
        },
      });
      if (result.kind !== "prepared") throw new Error("Expected a prepared Profile");
      const bound = await bindMarkdownPdfCodexCandidate(runtime, result.candidate, {
        output: "accepted.yml",
        overwrite: false,
        report: { kind: "none" },
      });
      await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
      const terminal = stdout.text;
      expect(terminal).toContain("\\u0085\\u202e\\u2028");
      expect(terminal).toContain("\\u2029");
      expect(terminal).not.toContain("\u0085");
      expect(terminal).not.toContain("\u202e");
      expect(terminal).not.toContain("\u2028");
      expect(terminal).not.toContain("\u2029");
      const saved = await readMarkdownPdfProfileFile(join(fixtureDir, "accepted.yml"));
      expect(saved.pageNumbers).toMatchObject({ format: label });
      expect(saved.header).toMatchObject({ left: header });
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
          const factsMarker = "Deterministic facts:\n";
          const factsStart = options.prompt.indexOf(factsMarker);
          expect(factsStart).toBeGreaterThanOrEqual(0);
          const facts = JSON.parse(options.prompt.slice(factsStart + factsMarker.length)) as {
            selectedBaseProfile: { summary: { fields: string[] } };
          };
          expect(facts.selectedBaseProfile.summary.fields).toContain("header");
          expect(facts.selectedBaseProfile.summary.fields).not.toContain("pageNumbers");
          expect(options.prompt).not.toContain(" Exact {page} / {pages} ");
          expect(options.prompt).not.toContain("Exact {title}");
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
        const bound = await bindMarkdownPdfCodexCandidate(runtime, result.candidate, {
          output: "accepted-project",
          overwrite: false,
          report: { kind: "none" },
        });
        await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
        const savedPath = join(fixtureDir, "accepted-project", "profile.yml");
        const saved = await readMarkdownPdfProfileFile(savedPath);
        expect(saved.pageNumbers).toMatchObject({
          format: " Exact {page} / {pages} ",
          position: "bottom-center",
        });
        expect(saved.header).toMatchObject({ left: "Exact {title}" });
        expect(saved.fonts).toMatchObject({ pageChrome: { default: "Example Serif" } });
        expect(await readFile(savedPath, "utf8")).toBe(
          result.candidate.prepared.profilePhase.serializedProfile,
        );
      }
    });
  });
});
