import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, mock, test } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../src/adapters/codex/markdown-pdf-template";
import {
  collectMdPdfProjectCodexSignals,
  createMdPdfProjectCodexRenderCommand,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  validateMdPdfProjectCodexProject,
  type MdPdfProjectCodexOptions,
} from "../../src/cli/markdown-pdf/project-codex";
import type { MarkdownPdfProjectCodexOutputPlan } from "../../src/cli/markdown-pdf/project-codex/types";
import { minimalPng, pathExists } from "../cli-actions-md-to-pdf-template-codex/fixtures";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

type ProjectValidationFixtureOptions = MdPdfProjectCodexOptions & {
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  templateCodexRunner?: MarkdownPdfTemplateCodexRunner;
};

afterEach(() => {
  mock.restore();
});

function adaptedProfileRunner(
  input: {
    candidateId?: string;
    patches?: Array<{ op: "replace"; path: string; value: unknown }>;
    unmatchedDirections?: string[];
  } = {},
) {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: input.candidateId ?? "article",
      accepted_patches: input.patches ?? [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: input.unmatchedDirections ?? [],
    });
}

function templateResponse(input: {
  coverEnabled?: boolean;
  decisionMode?: string;
  recipePreset?: string;
  recipeSource?: string;
  templateFamily?: string;
  fallbackReason?: string;
}): string {
  const coverEnabled = input.coverEnabled ?? false;
  const recipePreset = input.recipePreset ?? "article";
  return JSON.stringify({
    decision_mode: input.decisionMode ?? "adapted",
    template_family:
      input.templateFamily ?? (coverEnabled ? "cover-media-layered" : "document-layered"),
    recipe_preset: recipePreset,
    slots: {
      recipe_preset: {
        preset: recipePreset === "none" ? "article" : recipePreset,
        source: input.recipeSource ?? "base-profile",
      },
      cover: {
        enabled: coverEnabled,
        byline: "none",
        composition: coverEnabled ? "media-first-caption" : "title-subtitle-media",
        image_fit: coverEnabled ? "cover" : "",
        image_anchor: "center",
        media_align: "center",
        media_scale: coverEnabled ? "hero" : "balanced",
        text_align: "center",
        style: coverEnabled ? "media" : "none",
        orientation_bucket: coverEnabled ? "landscape" : "unknown",
        fit_pressure: coverEnabled ? "normal" : "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: [],
    managed_assets: coverEnabled
      ? [{ bundle_path: "assets/cover.png", source_label: "cover.png" }]
      : [],
    warnings: [],
    unsupported_directions: [],
    fallback_reason: input.fallbackReason ?? "",
  });
}

function noUsableTemplateResponse(reason = "Unsupported template direction."): string {
  return templateResponse({
    coverEnabled: false,
    decisionMode: "no-usable-template",
    fallbackReason: reason,
    recipePreset: "none",
    templateFamily: "none",
  });
}

function validationStatusSummary(
  validation: ReturnType<typeof validateMdPdfProjectCodexProject>,
): Array<{ name: string; status: string }> {
  return validation.results.map((result) => ({
    name: result.name,
    status: result.status,
  }));
}

function expectNoUsableValidationFailure(
  validation: ReturnType<typeof validateMdPdfProjectCodexProject>,
  input: { messageIncludes?: string; name: string },
): void {
  expect(validation.decisionMode).toBe("no-usable-project");
  expect(validation.renderCommand).toBeUndefined();
  const failedResult = validation.results.find((result) => result.name === input.name);
  expect(failedResult).toMatchObject({
    name: input.name,
    status: "failed",
  });
  if (input.messageIncludes) {
    expect(failedResult?.message).toContain(input.messageIncludes);
    expect(validation.fallbackReason).toContain(input.messageIncludes);
  }
  expect(validation.results.at(-1)).toMatchObject({
    name: "render-command",
    status: "skipped",
  });
}

async function expectNoPlannedProjectArtifacts(
  outputPlan: MarkdownPdfProjectCodexOutputPlan,
): Promise<void> {
  expect(await pathExists(outputPlan.outputDirectory)).toBe(false);
  expect(await pathExists(outputPlan.profile.path)).toBe(false);
  expect(await pathExists(outputPlan.templateHtml.path)).toBe(false);
  expect(await pathExists(outputPlan.styleCss.path)).toBe(false);
  for (const asset of outputPlan.assets) {
    expect(await pathExists(asset.path)).toBe(false);
  }
  if (outputPlan.report) {
    expect(await pathExists(outputPlan.report.path)).toBe(false);
  }
}

function plannedOutputForRenderCommand(outputDirectory: string): MarkdownPdfProjectCodexOutputPlan {
  return {
    assets: [],
    generatedOutputDirectory: false,
    identity: {
      createdAt: "2026-07-04T08:00:00Z",
      outputDirectory,
      profileId: "md-pdf-profile-20260704T080000Z-abc12345",
      projectBundleId: "md-pdf-project-20260704T080000Z-abc12345",
      templateBundleId: "md-pdf-template-20260704T080000Z-abc12345",
    },
    outputDirectory,
    profile: { bundlePath: "profile.yml", path: join(outputDirectory, "profile.yml") },
    templateHtml: { bundlePath: "template.html", path: join(outputDirectory, "template.html") },
    styleCss: { bundlePath: "style.css", path: join(outputDirectory, "style.css") },
  };
}

async function runValidationFixture(fixtureDir: string, options: ProjectValidationFixtureOptions) {
  const { runtime } = createActionTestRuntime({
    cwd: fixtureDir,
    now: () => new Date("2026-07-04T08:00:00.000Z"),
  });
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, options);
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  const outputPlan = await planMdPdfProjectCodexOutput({
    identityUidFactory: () => "abc12345",
    runtime,
    signalMode: signals.modes.project,
    state,
  });
  const profilePhase = await runMdPdfProjectCodexProfilePhase({
    outputPlan,
    profileCodexRunner: options.profileCodexRunner,
    runtime,
    signals,
    state,
  });
  const templatePhase = await runMdPdfProjectCodexTemplatePhase({
    outputPlan,
    profilePhase,
    runtime,
    signals,
    state,
    templateCodexRunner: options.templateCodexRunner,
  });
  const validation = validateMdPdfProjectCodexProject({
    outputPlan,
    profilePhase,
    runtime,
    state,
    templatePhase,
  });
  return { outputPlan, profilePhase, runtime, signals, state, templatePhase, validation };
}

describe("cli action modules: md pdf-project codex validation", () => {
  test("validates deterministic project artifacts and creates a placeholder render command", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-deterministic",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
          "utf8",
        );

        const { outputPlan, validation } = await runValidationFixture(fixtureDir, {
          baseProfile: "base.yml",
        });

        expect(validation.decisionMode).toBe("deterministic");
        expect(validationStatusSummary(validation)).toEqual([
          { name: "profile-shape", status: "passed" },
          { name: "profile-normalization", status: "passed" },
          { name: "template-static-validation", status: "passed" },
          { name: "artifact-boundaries", status: "passed" },
          { name: "managed-asset-bindings", status: "passed" },
          { name: "profile-template-compatibility", status: "passed" },
          { name: "render-command", status: "passed" },
        ]);
        expect(validation.renderCommand).toMatchObject({
          executable: "cdx-chores",
          args: [
            "md",
            "to-pdf",
            "--input",
            "<input.md>",
            "--profile",
            "md-pdf-project-20260704T080000Z-abc12345/profile.yml",
            "--template",
            "md-pdf-project-20260704T080000Z-abc12345/template.html",
            "--css",
            "md-pdf-project-20260704T080000Z-abc12345/style.css",
            "--output",
            "<output.pdf>",
          ],
        });
        expect(validation.renderCommand?.display).not.toContain(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("keeps render command input replayable without absolute local paths", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-input", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

      const { outputPlan, validation } = await runValidationFixture(fixtureDir, {
        input: "report.md",
        profileCodexRunner: adaptedProfileRunner(),
      });

      expect(validation.decisionMode).toBe("adapted");
      expect(validation.renderCommand?.args).toContain("report.md");
      expect(validation.renderCommand?.display).toContain("'report.md'");
      expect(validation.renderCommand?.display).not.toContain(fixtureDir);
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("maps no-usable template validation to no-usable project without a render command", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

      const { validation } = await runValidationFixture(fixtureDir, {
        input: "report.md",
        profileCodexRunner: adaptedProfileRunner({ unmatchedDirections: ["fetch remote CSS"] }),
        templateCodexRunner: async () => noUsableTemplateResponse("Remote CSS is unsupported."),
      });

      expect(validation.decisionMode).toBe("no-usable-project");
      expect(validation.fallbackReason).toBe("Remote CSS is unsupported.");
      expect(validation.renderCommand).toBeUndefined();
      expect(validationStatusSummary(validation)).toEqual([
        { name: "profile-shape", status: "passed" },
        { name: "profile-normalization", status: "passed" },
        { name: "template-static-validation", status: "skipped" },
        { name: "artifact-boundaries", status: "passed" },
        { name: "managed-asset-bindings", status: "skipped" },
        { name: "profile-template-compatibility", status: "skipped" },
        { name: "render-command", status: "skipped" },
      ]);
      expect(validation.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Template phase returned no usable project.",
            name: "template-static-validation",
          }),
          expect.objectContaining({
            message: "Skipped because validation produced no usable project.",
            name: "render-command",
          }),
        ]),
      );
    });
  });

  test("rejects malformed project output plans that leave artifact boundaries", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-boundaries", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
        "utf8",
      );

      const { outputPlan, profilePhase, runtime, state, templatePhase } =
        await runValidationFixture(fixtureDir, {
          baseProfile: "base.yml",
          keepCodexReport: true,
        });
      const boundaryCases: Array<{
        expectedMessage: string;
        outputPlan: MarkdownPdfProjectCodexOutputPlan;
      }> = [
        {
          expectedMessage: "profile.yml must stay inside the project output directory.",
          outputPlan: {
            ...outputPlan,
            profile: { ...outputPlan.profile, path: join(fixtureDir, "outside-profile.yml") },
          },
        },
        {
          expectedMessage: "template.html must stay inside the project output directory.",
          outputPlan: {
            ...outputPlan,
            templateHtml: {
              ...outputPlan.templateHtml,
              path: join(fixtureDir, "outside-template.html"),
            },
          },
        },
        {
          expectedMessage: "style.css must stay inside the project output directory.",
          outputPlan: {
            ...outputPlan,
            styleCss: { ...outputPlan.styleCss, path: join(fixtureDir, "outside-style.css") },
          },
        },
        {
          expectedMessage: "project Codex report must stay inside the project output directory.",
          outputPlan: {
            ...outputPlan,
            report: {
              bundlePath: "project.codex-report.json",
              location: "in-bundle",
              path: join(fixtureDir, "outside-report.json"),
            },
          },
        },
        {
          expectedMessage: "profile.yml must use a project-relative bundle path.",
          outputPlan: {
            ...outputPlan,
            profile: { ...outputPlan.profile, bundlePath: "../profile.yml" },
          },
        },
        {
          expectedMessage: "template.html must use a project-relative bundle path.",
          outputPlan: {
            ...outputPlan,
            templateHtml: { ...outputPlan.templateHtml, bundlePath: "/template.html" },
          },
        },
        {
          expectedMessage: "style.css must use a project-relative bundle path.",
          outputPlan: {
            ...outputPlan,
            styleCss: { ...outputPlan.styleCss, bundlePath: "..\\style.css" },
          },
        },
        {
          expectedMessage: "project Codex report must use a project-relative bundle path.",
          outputPlan: {
            ...outputPlan,
            report: {
              bundlePath: "../project.codex-report.json",
              location: "in-bundle",
              path: join(outputPlan.outputDirectory, "project.codex-report.json"),
            },
          },
        },
        {
          expectedMessage: "managed asset ../cover.png must use a project-relative bundle path.",
          outputPlan: {
            ...outputPlan,
            assets: [
              {
                bundlePath: "../cover.png",
                path: join(outputPlan.outputDirectory, "assets", "cover.png"),
                role: "cover-image",
                sourceBasename: "cover.png",
                sourcePath: join(fixtureDir, "cover.png"),
              },
            ],
          },
        },
      ];

      for (const boundaryCase of boundaryCases) {
        const validation = validateMdPdfProjectCodexProject({
          outputPlan: boundaryCase.outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase,
        });

        expectNoUsableValidationFailure(validation, {
          name: "artifact-boundaries",
          messageIncludes: boundaryCase.expectedMessage,
        });
      }
    });
  });

  test("rejects malformed final profile output before render command generation", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-profile-failure",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
          "utf8",
        );

        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, {
            baseProfile: "base.yml",
          });
        const malformedProfiles = [
          {
            expectedMessage: "Unknown Markdown PDF profile key: profile.unknownRoot",
            name: "profile-shape",
            profile: { ...profilePhase.finalProfile, unknownRoot: true },
          },
          {
            expectedMessage: "profile.titleBlock.metadataTitle must be one of: auto, show, hide.",
            name: "profile-normalization",
            profile: {
              ...profilePhase.finalProfile,
              titleBlock: { metadataTitle: "sometimes" },
            },
          },
        ];

        for (const malformedProfile of malformedProfiles) {
          const validation = validateMdPdfProjectCodexProject({
            outputPlan,
            profilePhase: {
              ...profilePhase,
              finalProfile: malformedProfile.profile,
            },
            runtime,
            state,
            templatePhase,
          });

          expectNoUsableValidationFailure(validation, {
            name: malformedProfile.name,
            messageIncludes: malformedProfile.expectedMessage,
          });
        }
      },
    );
  });

  test("sanitizes render command paths outside cwd and keeps placeholders replayable", () => {
    const { runtime } = createActionTestRuntime({ cwd: "/repo" });
    const command = createMdPdfProjectCodexRenderCommand({
      outputPlan: plannedOutputForRenderCommand("/external/project"),
      runtime,
      state: {
        inputPath: "/secret/report.md",
        fontHints: [],
        dryRun: false,
        keepCodexReport: false,
        overwrite: false,
      },
    });

    expect(command.args).toEqual([
      "md",
      "to-pdf",
      "--input",
      "<input.md>",
      "--profile",
      "<project-bundle>/profile.yml",
      "--template",
      "<project-bundle>/template.html",
      "--css",
      "<project-bundle>/style.css",
      "--output",
      "<output.pdf>",
    ]);
    expect(command.display).not.toContain("/secret");
    expect(command.display).not.toContain("/external");
  });

  test("quotes render command paths with spaces and single quotes", () => {
    const { runtime } = createActionTestRuntime({ cwd: "/repo" });
    const command = createMdPdfProjectCodexRenderCommand({
      outputPlan: plannedOutputForRenderCommand("/repo/project dir"),
      runtime,
      state: {
        inputPath: "/repo/report's file.md",
        fontHints: [],
        dryRun: false,
        keepCodexReport: false,
        overwrite: false,
      },
    });

    expect(command.args).toContain("report's file.md");
    expect(command.args).toContain("project dir/profile.yml");
    expect(command.display).toContain("'report'\\''s file.md'");
    expect(command.display).toContain("'project dir/profile.yml'");
  });

  test("normalizes Windows-style render command paths relative to Windows cwd", () => {
    const { runtime } = createActionTestRuntime({ cwd: "C:\\work\\repo" });
    const command = createMdPdfProjectCodexRenderCommand({
      outputPlan: plannedOutputForRenderCommand("C:\\work\\repo\\project"),
      runtime,
      state: {
        inputPath: "C:\\work\\repo\\draft.md",
        fontHints: [],
        dryRun: false,
        keepCodexReport: false,
        overwrite: false,
      },
    });

    expect(command.args).toContain("draft.md");
    expect(command.args).toContain("project/profile.yml");
    expect(command.display).not.toContain("C:\\work");
  });

  test("rejects generated template CSS that leaks unsafe resource references", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-unsafe-css", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

      const { outputPlan, profilePhase, runtime, state, templatePhase } = await (async () => {
        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });
        const profilePhase = await runMdPdfProjectCodexProfilePhase({
          outputPlan,
          profileCodexRunner: adaptedProfileRunner(),
          runtime,
          signals,
          state,
        });
        const templatePhase = await runMdPdfProjectCodexTemplatePhase({
          outputPlan,
          profilePhase,
          runtime,
          signals,
          state,
        });
        return { outputPlan, profilePhase, runtime, state, templatePhase };
      })();
      const unsafeTemplatePhase = {
        ...templatePhase,
        synthesis: {
          ...templatePhase.synthesis,
          styleCss: `${templatePhase.synthesis.styleCss}\nbody { background-image: url(file:///Users/private/cover.png); }\n`,
        },
      };

      const validation = validateMdPdfProjectCodexProject({
        outputPlan,
        profilePhase,
        runtime,
        state,
        templatePhase: unsafeTemplatePhase,
      });

      expectNoUsableValidationFailure(validation, { name: "template-static-validation" });
    });
  });

  test("rejects templates that drop profile-owned ToC hooks", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-toc-hooks", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\ntoc:\n  enabled: true\n",
        "utf8",
      );

      const { outputPlan, profilePhase, runtime, state, templatePhase } =
        await runValidationFixture(fixtureDir, {
          baseProfile: "base.yml",
        });
      const invalidTemplatePhase = {
        ...templatePhase,
        synthesis: {
          ...templatePhase.synthesis,
          templateHtml: templatePhase.synthesis.templateHtml.replace("$toc$", ""),
        },
      };

      const validation = validateMdPdfProjectCodexProject({
        outputPlan,
        profilePhase,
        runtime,
        state,
        templatePhase: invalidTemplatePhase,
      });

      expectNoUsableValidationFailure(validation, {
        name: "template-static-validation",
        messageIncludes: "Pandoc ToC region",
      });
    });
  });

  test("rejects stylesheets that drop profile-owned Shiki hooks", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-shiki-hooks", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\ncode:\n  highlight: true\n",
        "utf8",
      );

      const { outputPlan, profilePhase, runtime, state, templatePhase } =
        await runValidationFixture(fixtureDir, {
          baseProfile: "base.yml",
        });
      const invalidTemplatePhase = {
        ...templatePhase,
        synthesis: {
          ...templatePhase.synthesis,
          styleCss: templatePhase.synthesis.styleCss.replaceAll(".cdx-code-line", ".code-line"),
        },
      };

      const validation = validateMdPdfProjectCodexProject({
        outputPlan,
        profilePhase,
        runtime,
        state,
        templatePhase: invalidTemplatePhase,
      });

      expectNoUsableValidationFailure(validation, {
        name: "template-static-validation",
        messageIncludes: "code-line-selector",
      });
    });
  });

  test("rejects templates that invert profile-owned metadata title visibility", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-title-policy", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\ntitleBlock:\n  metadataTitle: show\n",
        "utf8",
      );

      const { outputPlan, profilePhase, runtime, state, templatePhase } =
        await runValidationFixture(fixtureDir, {
          baseProfile: "base.yml",
        });
      const invalidTemplatePhase = {
        ...templatePhase,
        synthesis: {
          ...templatePhase.synthesis,
          titlePolicy: {
            ...templatePhase.synthesis.titlePolicy,
            visibleMetadataTitle: false,
          },
        },
      };

      const validation = validateMdPdfProjectCodexProject({
        outputPlan,
        profilePhase,
        runtime,
        state,
        templatePhase: invalidTemplatePhase,
      });

      expectNoUsableValidationFailure(validation, {
        name: "profile-template-compatibility",
        messageIncludes: "metadata title output",
      });
    });
  });

  test("rejects template font decisions that override profile-owned fonts", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-font-override",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\nfonts:\n  body:\n    default: Source Serif 4\n",
          "utf8",
        );

        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, {
            baseProfile: "base.yml",
          });
        const invalidTemplatePhase = {
          ...templatePhase,
          synthesis: {
            ...templatePhase.synthesis,
            fontDecisions: [
              ...templatePhase.synthesis.fontDecisions,
              {
                role: "body" as const,
                key: "default",
                family: "Other Serif",
                source: "template-style" as const,
                templateLevel: true,
                status: "applied" as const,
                profileOwned: true,
                overridesProfileFont: true,
                reason: "template-level-override" as const,
              },
            ],
          },
        };

        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase: invalidTemplatePhase,
        });

        expectNoUsableValidationFailure(validation, {
          name: "profile-template-compatibility",
          messageIncludes: "profile-owned font decisions",
        });
      },
    );
  });

  test("rejects managed asset bindings that are not in the project output plan", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-managed-assets",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));

        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, {
            coverImage: "cover.png",
          });
        const invalidTemplatePhase = {
          ...templatePhase,
          synthesis: {
            ...templatePhase.synthesis,
            managedAssets: [
              ...templatePhase.synthesis.managedAssets,
              {
                role: "cover-image" as const,
                bundlePath: "assets/unplanned.png",
                sourceBasename: "unplanned.png",
              },
            ],
          },
        };

        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase: invalidTemplatePhase,
        });

        expectNoUsableValidationFailure(validation, {
          name: "managed-asset-bindings",
          messageIncludes: "unplanned managed asset",
        });
      },
    );
  });

  test("rejects templates that silently drop a profile-owned text cover", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-cover", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\ncover:\n  enabled: true\n  style: report\n  fields:\n    title: Project Cover\n",
        "utf8",
      );

      const { validation } = await runValidationFixture(fixtureDir, {
        baseProfile: "base.yml",
      });

      expectNoUsableValidationFailure(validation, {
        name: "profile-template-compatibility",
        messageIncludes: "profile-owned text cover",
      });
    });
  });

  test("validates cover image projects without disclosing the source asset path", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-cover-image", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));

      const { outputPlan, validation } = await runValidationFixture(fixtureDir, {
        coverImage: "cover.png",
      });

      expect(validation.decisionMode).toBe("deterministic");
      expect(validation.renderCommand?.display).not.toContain(fixtureDir);
      expect(validation.renderCommand?.display).not.toContain("cover.png");
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });
});
