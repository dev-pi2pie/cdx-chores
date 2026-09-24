import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

import { actionMdPdfProjectCodex, actionMdToPdf } from "../../../../src/cli/actions/markdown";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { pathExists } from "../../support/path-fixtures";
import { createPdfRunner } from "../rendering/render-support";
import { minimalPng } from "../template-codex/fixtures";
import { responseFromDecision } from "../../adapters/template-codex-fixtures";

function adaptedProfile(candidateId: string): string {
  return JSON.stringify({
    decision_mode: "adapted",
    selected_candidate_id: candidateId,
    accepted_patches: [],
    project_cover_intent: "unspecified",
    accepted_font_patches: [],
    reasoning: "Use the reviewed cover signals.",
    warnings: [],
    fallback_reason: "",
    unmatched_directions: [],
  });
}

describe("Project text-cover handoff", () => {
  test.each([
    "Do not add a text-only cover",
    "No text cover",
    "Leave the cover out",
    "Leave the text-only cover out",
    "A cover is unnecessary",
    "I don't want to add a cover",
  ])("saves a cover-disabled model decision for %s", async (intent) => {
    await withTempFixtureDir("md-pdf-project-negated-text-cover", async (fixtureDir) => {
      let profileCalls = 0;
      let templateCalls = 0;
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await actionMdPdfProjectCodex(runtime, {
        intent,
        output: "project",
        profileCodexRunner: async () => {
          profileCalls += 1;
          const decision = JSON.parse(adaptedProfile("article"));
          decision.accepted_patches = [{ op: "replace", path: "/cover/enabled", value: false }];
          return JSON.stringify(decision);
        },
        templateCodexRunner: async ({ prompt }) => {
          templateCalls += 1;
          expect(prompt).toContain('"projectTextCover": false');
          return responseFromDecision({
            coverEnabled: false,
            templateFamily: "document-layered",
            recipeSource: "base-profile",
          });
        },
      });
      expect(profileCalls).toBe(1);
      expect(templateCalls).toBe(1);
      const profile = parse(await readFile(join(fixtureDir, "project/profile.yml"), "utf8"));
      expect(profile.cover.enabled).toBe(false);
      const template = await readFile(join(fixtureDir, "project/template.html"), "utf8");
      expect(template).not.toContain('<section class="pdf-cover');
      expect(template).not.toContain("data-cdx-profile-text-cover");
    });
  });

  test.each([
    ["請加入文字封面", "text-only", true],
    ["Add a titlepage", "requested", true],
    ["Use readable typography", "unspecified", false],
    ["請不要加入封面", "no-cover", false],
    ["Start page numbering after the cover", "unspecified", false],
  ] as const)("saves interpreted cover intent for %s", async (intent, interpretation, enabled) => {
    await withTempFixtureDir("md-pdf-interpreted-cover", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await actionMdPdfProjectCodex(runtime, {
        intent,
        output: "project",
        profileCodexRunner: async ({ prompt }) => {
          expect(prompt).toContain("project_cover_intent");
          const response = JSON.parse(adaptedProfile("article"));
          response.project_cover_intent = interpretation;
          // Even an inferred model cover must remain OFF when no cover was requested.
          response.accepted_patches = [{ op: "replace", path: "/cover/enabled", value: true }];
          return JSON.stringify(response);
        },
        templateCodexRunner: async () =>
          responseFromDecision({
            coverEnabled: false,
            templateFamily: "document-layered",
            recipeSource: "base-profile",
          }),
      });
      const saved = parse(await readFile(join(fixtureDir, "project/profile.yml"), "utf8"));
      expect(saved.cover.enabled).toBe(enabled);
      expect(
        (await readFile(join(fixtureDir, "project/template.html"), "utf8")).includes(
          "data-cdx-profile-text-cover",
        ),
      ).toBe(enabled);
    });
  });

  test("saves a reusable Profile cover hook and resolves later document metadata", async () => {
    await withTempFixtureDir("md-pdf-project-text-cover-handoff", async (fixtureDir) => {
      const projectPath = join(fixtureDir, "project");
      const markdownPath = join(fixtureDir, "later.md");
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "cover:",
          "  enabled: true",
          "  style: report",
          "  fields:",
          '    title: "{title}"',
          '    subtitle: "{subtitle}"',
          "titleBlock:",
          "  metadataTitle: auto",
          "",
        ].join("\n"),
        "utf8",
      );
      const { runtime: projectRuntime } = createActionTestRuntime({ cwd: fixtureDir });
      await actionMdPdfProjectCodex(projectRuntime, {
        baseProfile: "base.yml",
        output: "project",
      });

      const savedTemplate = await readFile(join(projectPath, "template.html"), "utf8");
      const savedProfile = await readFile(join(projectPath, "profile.yml"), "utf8");
      expect(savedTemplate).toContain('data-cdx-profile-text-cover="true"');
      expect(savedTemplate).not.toContain("Later Title");
      expect(savedProfile).toContain('title: "{title}"');
      await writeFile(
        markdownPath,
        ["---", "title: Later Title", "subtitle: Later Subtitle", "---", "# Body", ""].join("\n"),
        "utf8",
      );

      const { runner } = createPdfRunner({ html: "<html><body>Body</body></html>" });
      let renderedTemplate = "";
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, options) => {
        if (command === "pandoc" && !args.includes("--version")) {
          renderedTemplate = await readFile(args[args.indexOf("--template") + 1]!, "utf8");
        }
        return runner(command, args, options);
      };
      const { runtime: renderRuntime } = createActionTestRuntime({ cwd: fixtureDir });
      await actionMdToPdf(renderRuntime, {
        input: "later.md",
        bundle: "project",
        output: "later.pdf",
        runner: capturingRunner,
      });

      expect(renderedTemplate).toContain("Later Title");
      expect(renderedTemplate).toContain("Later Subtitle");
      expect(renderedTemplate.match(/<section class="pdf-cover\b/gu)).toHaveLength(1);
      expect(renderedTemplate).not.toContain('data-cdx-profile-text-cover="true"');
      expect(renderedTemplate).not.toContain('<header class="document-title">');
      expect(await readFile(join(fixtureDir, "later.pdf"), "utf8")).toContain("%PDF");
      expect(await readFile(join(projectPath, "template.html"), "utf8")).toBe(savedTemplate);
    });
  });

  test("rejects an image against an explicitly disabled base cover before model requests", async () => {
    await withTempFixtureDir("md-pdf-project-cover-early-conflict", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), "cover:\n  enabled: false\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      await writeFile(join(fixtureDir, "sample.md"), "# Sample\n", "utf8");
      let calls = 0;
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await expectCliError(
        () =>
          actionMdPdfProjectCodex(runtime, {
            baseProfile: "base.yml",
            coverImage: "cover.png",
            input: "sample.md",
            intent: "Make a report",
            output: "project",
            profileCodexRunner: async () => {
              calls += 1;
              return adaptedProfile("base-profile");
            },
          }),
        {
          code: "MARKDOWN_PDF_PROJECT_COVER_CONFLICT",
          exitCode: 2,
          messageIncludes: "base Profile's disabled cover",
        },
      );
      expect(calls).toBe(0);
      expect(await pathExists(join(fixtureDir, "project"))).toBe(false);
    });
  });

  test("stops a cover-intent conflict after Profile request and before Template request", async () => {
    await withTempFixtureDir("md-pdf-project-cover-late-conflict", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), "cover:\n  enabled: false\n", "utf8");
      await writeFile(join(fixtureDir, "sample.md"), "# Sample\n", "utf8");
      let profileCalls = 0;
      let templateCalls = 0;
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await expectCliError(
        () =>
          actionMdPdfProjectCodex(runtime, {
            baseProfile: "base.yml",
            input: "sample.md",
            intent: "Add a text-only cover",
            output: "project",
            profileCodexRunner: async () => {
              profileCalls += 1;
              return adaptedProfile("base-profile");
            },
            templateCodexRunner: async () => {
              templateCalls += 1;
              throw new Error("Template must not start");
            },
          }),
        {
          code: "MARKDOWN_PDF_PROJECT_COVER_CONFLICT",
          exitCode: 2,
          messageIncludes: "cover choices conflict",
        },
      );
      expect(profileCalls).toBe(1);
      expect(templateCalls).toBe(0);
      expect(await pathExists(join(fixtureDir, "project"))).toBe(false);
    });
  });

  test("treats a selected image as a Profile cover signal without cover prose", async () => {
    await withTempFixtureDir("md-pdf-project-image-cover-signal", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      await writeFile(join(fixtureDir, "sample.md"), "# Sample\n", "utf8");
      let profilePrompt = "";
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProjectCodex(runtime, {
        coverImage: "cover.png",
        input: "sample.md",
        output: "project",
        profileCodexRunner: async ({ prompt }) => {
          profilePrompt = prompt;
          return adaptedProfile("article");
        },
      });

      expect(profilePrompt).toContain('"projectCoverImageAvailable": true');
      const savedProfile = await readFile(join(fixtureDir, "project", "profile.yml"), "utf8");
      expect(savedProfile).toContain("cover:");
      expect(savedProfile).toContain("enabled: true");
      expect(await pathExists(join(fixtureDir, "project", "assets", "cover.png"))).toBe(true);
    });
  });
});
