import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, mock, test } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../../src/adapters/codex/markdown-pdf-template";
import {
  collectMdPdfProjectCodexSignals,
  createMdPdfProjectCodexHandoffProjection,
  createMdPdfProjectCodexRenderCommand,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  validateMdPdfProjectCodexProject,
  type MdPdfProjectCodexOptions,
} from "../../../src/cli/markdown-pdf/project-codex";
import type { MarkdownPdfProjectCodexOutputPlan } from "../../../src/cli/markdown-pdf/project-codex/types";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { pathExists } from "../support/path-fixtures";
import { minimalPng } from "./template-codex-fixtures";

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
  return async ({ prompt }: { prompt: string }) =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id:
        input.candidateId ?? (prompt.includes('"id": "base-profile"') ? "base-profile" : "article"),
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
  cssBlocks?: Array<{ css: string; slot: "spacing" }>;
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
    css_blocks: input.cssBlocks ?? [],
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
          { name: "profile-body-page-number-compatibility", status: "passed" },
          { name: "template-page-number-css-ownership", status: "passed" },
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
            "--bundle",
            "md-pdf-project-20260704T080000Z-abc12345",
            "--output",
            "<output.pdf>",
          ],
        });
        expect(validation.renderCommand?.display).not.toContain(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("projects Profile revision advisories through validation and the planned handoff", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-profile-revision",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "base.yml"), "pageNumbers:\n  enabled: false\n", "utf8");
        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, { baseProfile: "base.yml" });
        const cases = [
          {
            conditionId: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_INVALID",
            declaration: "3",
            pageNumbers: { enabled: false },
            state: "invalid",
          },
          {
            conditionId: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE",
            declaration: 2,
            pageNumbers: { enabled: false, start: 0 },
            state: "stale",
          },
          {
            conditionId: "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_FORWARD",
            declaration: 4,
            pageNumbers: { enabled: false },
            state: "forward",
          },
        ] as const;

        for (const diagnosticCase of cases) {
          const advisoryProfilePhase = {
            ...profilePhase,
            finalProfile: {
              ...profilePhase.finalProfile,
              schemaVersion: diagnosticCase.declaration,
              pageNumbers: diagnosticCase.pageNumbers,
            },
          };
          const validation = validateMdPdfProjectCodexProject({
            outputPlan,
            profilePhase: advisoryProfilePhase,
            runtime,
            state,
            templatePhase,
          });

          expect(validation.diagnostics.conditions).toEqual([
            expect.objectContaining({
              conditionId: diagnosticCase.conditionId,
              context: expect.objectContaining({
                currentRevision: 3,
                kind: "profile-schema-version",
                state: diagnosticCase.state,
              }),
            }),
          ]);

          const handoff = createMdPdfProjectCodexHandoffProjection({
            outputPlan,
            profilePhase: advisoryProfilePhase,
            runtime,
            state,
            validation,
          });
          expect(handoff.diagnostics).toEqual(validation.diagnostics.conditions);
          expect(handoff.diagnostics[0]?.conditionId).toBe(diagnosticCase.conditionId);
        }
      },
    );
  });

  test("derives the pages-token migration from real legacy Profile validation", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-pages-migration",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "base.yml"), "pageNumbers:\n  enabled: false\n", "utf8");
        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, { baseProfile: "base.yml" });

        for (const declaredRevision of [1, 2] as const) {
          const legacyProfilePhase = {
            ...profilePhase,
            finalProfile: {
              ...profilePhase.finalProfile,
              schemaVersion: declaredRevision,
              pageNumbers: {
                enabled: true,
                format: "Page {page} of {pages}",
              },
            },
          };
          const validation = validateMdPdfProjectCodexProject({
            outputPlan,
            profilePhase: legacyProfilePhase,
            runtime,
            state,
            templatePhase,
          });

          const conditionIds = validation.diagnostics.conditions.map(
            ({ conditionId }) => conditionId,
          );
          if (declaredRevision === 1) {
            expect(conditionIds).toEqual([
              "MARKDOWN_PDF_PROFILE_SCHEMA_VERSION_STALE",
              "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
            ]);
          } else {
            expect(conditionIds).toEqual(["MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION"]);
          }
          expect(validation.diagnostics.conditions.at(-1)).toMatchObject({
            conditionId: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
            context: {
              kind: "legacy-pages-token-migration",
              countFrom: "document",
              declaredRevision,
            },
            severity: "warning",
          });

          const handoff = createMdPdfProjectCodexHandoffProjection({
            outputPlan,
            profilePhase: legacyProfilePhase,
            runtime,
            state,
            validation,
          });
          expect(handoff.diagnostics).toEqual(validation.diagnostics.conditions);
        }
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
        { name: "profile-body-page-number-compatibility", status: "skipped" },
        { name: "template-page-number-css-ownership", status: "skipped" },
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
      "--bundle",
      "<project-bundle>",
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
    expect(command.args).toContain("project dir");
    expect(command.display).toContain("'report'\\''s file.md'");
    expect(command.display).toContain("'project dir'");
    expect(command.display).not.toContain("--profile");
    expect(command.display).not.toContain("--template");
    expect(command.display).not.toContain("--css");
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
    expect(command.args).toContain("project");
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

  test("returns a typed failure for Template-owned ordinary page-counter CSS", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-page-counter-css",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\n",
          "utf8",
        );
        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, { baseProfile: "base.yml" });
        const invalidTemplatePhase = {
          ...templatePhase,
          synthesis: {
            ...templatePhase.synthesis,
            styleCss: `${templatePhase.synthesis.styleCss}\n@page { @bottom-center { content: counter(page); } }\n`,
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
          name: "template-page-number-css-ownership",
          messageIncludes: "must not reference Profile-owned or indeterminate counters",
        });
      },
    );
  });

  test("rejects page-counter mutation received through a Codex Template CSS block", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-codex-counter-css",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
        const { validation, templatePhase } = await runValidationFixture(fixtureDir, {
          input: "report.md",
          intent: "apply custom CSS",
          profileCodexRunner: adaptedProfileRunner(),
          templateCodexRunner: async () =>
            templateResponse({
              cssBlocks: [
                {
                  css: "body { --folio: page 7; counter-set: var(--folio); }",
                  slot: "spacing",
                },
              ],
            }),
        });

        expect(templatePhase.codexResult?.decision.cssBlocks).toEqual([
          {
            css: "body { --folio: page 7; counter-set: var(--folio); }",
            slot: "spacing",
          },
        ]);
        expect(templatePhase.synthesis.styleCss).toContain("counter-set: var(--folio)");
        expectNoUsableValidationFailure(validation, {
          name: "template-page-number-css-ownership",
          messageIncludes: "indeterminate counter mutation",
        });
      },
    );
  });

  test("rejects indeterminate counter references received through a Codex Template CSS block", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-codex-counter-reference",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
        const { validation, templatePhase } = await runValidationFixture(fixtureDir, {
          input: "report.md",
          intent: "apply custom CSS",
          profileCodexRunner: adaptedProfileRunner(),
          templateCodexRunner: async () =>
            templateResponse({
              cssBlocks: [{ css: "body { --folio: counter(var(--folio)); }", slot: "spacing" }],
            }),
        });

        expect(templatePhase.synthesis.styleCss).toContain("counter(var(--folio))");
        expectNoUsableValidationFailure(validation, {
          name: "template-page-number-css-ownership",
          messageIncludes: "must not reference Profile-owned or indeterminate counters",
        });
      },
    );
  });

  test("rejects typed attr counter mutation received through a Codex Template CSS block", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-codex-attr-counter-mutation",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
        const { validation, templatePhase } = await runValidationFixture(fixtureDir, {
          input: "report.md",
          intent: "apply custom CSS",
          profileCodexRunner: adaptedProfileRunner(),
          templateCodexRunner: async () =>
            templateResponse({
              cssBlocks: [
                {
                  css: "body { counter-reset: attr(data-counter type(<custom-ident>)); }",
                  slot: "spacing",
                },
              ],
            }),
        });

        expect(templatePhase.synthesis.styleCss).toContain(
          "counter-reset: attr(data-counter type(<custom-ident>))",
        );
        expectNoUsableValidationFailure(validation, {
          name: "template-page-number-css-ownership",
          messageIncludes: "indeterminate counter mutation",
        });
      },
    );
  });

  test("names final Profile and actual generated body incompatibility", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-profile-body-compatibility",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "pageNumbers:",
            "  enabled: true",
            "  scope: body",
            "  countFrom: body",
            "",
          ].join("\n"),
          "utf8",
        );
        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, { baseProfile: "base.yml" });
        const invalidTemplatePhase = {
          ...templatePhase,
          synthesis: {
            ...templatePhase.synthesis,
            templateHtml: templatePhase.synthesis.templateHtml.replace(
              "document-body",
              "article-body",
            ),
          },
        };

        const validation = validateMdPdfProjectCodexProject({
          outputPlan,
          profilePhase,
          runtime,
          state,
          templatePhase: invalidTemplatePhase,
        });

        expect(validation).toMatchObject({
          decisionMode: "no-usable-project",
          renderCommand: undefined,
        });
        expect(
          validation.results.find(
            (result) => result.name === "profile-body-page-number-compatibility",
          ),
        ).toMatchObject({
          name: "profile-body-page-number-compatibility",
          status: "failed",
          message: expect.stringContaining(
            "generated Project Template requires exactly one .document-body element",
          ),
        });
        expect(validation.diagnostics.conditions).toContainEqual({
          conditionId: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
          context: { kind: "missing-body-boundary" },
          message: expect.stringContaining(
            "generated Project Template requires exactly one .document-body element",
          ),
          severity: "error",
        });
      },
    );
  });

  test("rejects stylesheet ownership conflicts without relying on font decisions", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-font-css-conflict",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "fonts:",
            "  body:",
            "    default: Profile Body",
            "",
          ].join("\n"),
          "utf8",
        );

        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, {
            baseProfile: "base.yml",
          });
        expect(templatePhase.synthesis.fontDecisions).toEqual([]);
        const invalidTemplatePhase = {
          ...templatePhase,
          synthesis: {
            ...templatePhase.synthesis,
            fontDecisions: [],
            styleCss: `${templatePhase.synthesis.styleCss}\nbody { font-family: Forged Family; }\n`,
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
          messageIncludes: "ownership-aware synthesis from the final profile",
        });
      },
    );
  });

  test("rejects codex-assisted stylesheets that diverge from ownership-aware synthesis", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-validation-adapted-font-css-conflict",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "fonts:",
            "  body:",
            "    default: Profile Body",
            "",
          ].join("\n"),
          "utf8",
        );
        await writeFile(
          join(fixtureDir, "report.md"),
          [
            "# Report",
            "",
            "| c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 |",
            "| -- | -- | -- | -- | -- | -- | -- | -- |",
            "| a | b | c | d | e | f | g | h |",
            "",
          ].join("\n"),
          "utf8",
        );

        const { outputPlan, profilePhase, runtime, state, templatePhase } =
          await runValidationFixture(fixtureDir, {
            baseProfile: "base.yml",
            input: "report.md",
            profileCodexRunner: adaptedProfileRunner(),
            templateCodexRunner: async () =>
              templateResponse({ recipePreset: "wide-table", recipeSource: "document-signal" }),
          });
        expect(templatePhase.codexResult).toBeDefined();
        const invalidTemplatePhase = {
          ...templatePhase,
          synthesis: {
            ...templatePhase.synthesis,
            styleCss: `${templatePhase.synthesis.styleCss}\nbody { font-family: Forged Family; }\n`,
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
          messageIncludes: "ownership-aware synthesis from the final profile",
        });
      },
    );
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
                profileOwned: false,
                overridesProfileFont: false,
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
        name: "profile-cover-compatibility",
        messageIncludes: "exactly one live .pdf-cover",
      });
    });
  });

  test("projects empty Profile cover fields through managed Project diagnostics", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-empty-cover", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "cover:",
          "  enabled: true",
          "  fields:",
          '    title: ""',
          '    subtitle: ""',
          '    author: ""',
          '    company: ""',
          '    date: ""',
          "",
        ].join("\n"),
        "utf8",
      );

      const { outputPlan, profilePhase, runtime, state, validation } = await runValidationFixture(
        fixtureDir,
        {
          baseProfile: "base.yml",
          coverImage: "cover.png",
        },
      );

      expect(validation.decisionMode).toBe("deterministic");
      expect(validation.diagnostics.conditions).toEqual([
        expect.objectContaining({
          conditionId: "MARKDOWN_PDF_COVER_FIELDS_EMPTY",
          context: { kind: "empty-cover-fields" },
          severity: "warning",
        }),
      ]);
      expect(
        createMdPdfProjectCodexHandoffProjection({
          outputPlan,
          profilePhase,
          runtime,
          state,
          validation,
        }).diagnostics,
      ).toEqual(validation.diagnostics.conditions);
    });
  });

  test("validates cover image projects without disclosing the source asset path", async () => {
    await withTempFixtureDir("md-pdf-project-codex-validation-cover-image", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
          "  source: deterministic",
          "  createdAt: 2026-01-01T00:00:00Z",
          "fonts:",
          "  body:",
          "    default: Profile Body",
          "  heading:",
          "    default: Profile Heading",
          "cover:",
          "  enabled: true",
          "  fields:",
          "    title: Project Cover",
          "",
        ].join("\n"),
        "utf8",
      );

      const { outputPlan, templatePhase, validation } = await runValidationFixture(fixtureDir, {
        baseProfile: "base.yml",
        coverImage: "cover.png",
      });

      expect(validation.decisionMode).toBe("deterministic");
      expect(
        templatePhase.synthesis.templateHtml.match(/<section class="pdf-cover\b/g),
      ).toHaveLength(1);
      expect(validation.results).toContainEqual({
        name: "profile-cover-compatibility",
        status: "passed",
      });
      expect(validation.results).toContainEqual({
        name: "profile-body-page-number-compatibility",
        status: "passed",
      });
      expect(templatePhase.synthesis.styleCss).toContain(
        "font: 700 22pt/1.15 var(--template-heading-font);",
      );
      expect(templatePhase.synthesis.styleCss).toContain(
        "font: 12pt/1.35 var(--template-body-font);",
      );
      expect(validation.renderCommand?.display).not.toContain(fixtureDir);
      expect(validation.renderCommand?.display).not.toContain("cover.png");
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });
});
