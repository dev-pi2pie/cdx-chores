import { join } from "node:path";
import { writeFile } from "node:fs/promises";

import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
  MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS,
  type MarkdownPdfTemplateCodexRunner,
} from "../../src/adapters/codex/markdown-pdf-template";
import {
  collectMdPdfProjectCodexSignals,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
  type MdPdfProjectCodexOptions,
} from "../../src/cli/markdown-pdf/project-codex";
import type { MarkdownPdfCodexProfileRunner } from "../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfProjectCodexOutputPlan } from "../../src/cli/markdown-pdf/project-codex/types";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng } from "../markdown-pdf/actions/template-codex-fixtures";
import { pathExists } from "../markdown-pdf/support/path-fixtures";

type TemplatePhaseFixtureOptions = MdPdfProjectCodexOptions & {
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  stderrIsTTY?: boolean;
  templateCodexRunner?: MarkdownPdfTemplateCodexRunner;
};

afterEach(() => {
  mock.restore();
});

function adaptedProfileRunner(candidateId = "wide-table", unmatchedDirections: string[] = []) {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
      ],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: unmatchedDirections,
    });
}

function templateResponse(input: {
  coverEnabled?: boolean;
  cssBlocks?: Array<{ css: string; slot: string }>;
  decisionMode?: string;
  fontDecisions?: Array<{
    family: string;
    key: string;
    role: string;
    source: string;
    template_level: boolean;
  }>;
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
    font_decisions: input.fontDecisions ?? [],
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

function templatePromptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("template Codex prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
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

async function runTemplatePhaseFixture(fixtureDir: string, options: TemplatePhaseFixtureOptions) {
  const { runtime, stderr } = createActionTestRuntime({
    cwd: fixtureDir,
    now: () => new Date("2026-07-04T08:00:00.000Z"),
  });
  if (options.stderrIsTTY) {
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
  }
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
  return { outputPlan, profilePhase, stderr, templatePhase };
}

describe("cli action modules: md pdf-project codex template phase", () => {
  test("materializes base-profile-only deterministic template results without writing artifacts", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-base-only", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
          "  source: deterministic",
          "  createdAt: 2026-01-01T00:00:00Z",
          "page:",
          "  size: Letter",
          "pdf:",
          "  content-langs:",
          "    - ja",
          "fonts:",
          "  body:",
          "    default: Profile Body",
          "    ja: Profile Japanese",
          "  heading:",
          "    default: Profile Heading",
          "  code:",
          "    default: Profile Code",
          "    symbols: Profile Symbols",
          "  pageChrome:",
          "    default: Profile Chrome",
          "",
        ].join("\n"),
        "utf8",
      );
      let templateRunnerCallCount = 0;

      const { outputPlan, profilePhase, templatePhase } = await runTemplatePhaseFixture(
        fixtureDir,
        {
          baseProfile: "base.yml",
          templateCodexRunner: async () => {
            templateRunnerCallCount += 1;
            throw new Error("deterministic template phase must not invoke Codex");
          },
        },
      );

      expect(templateRunnerCallCount).toBe(0);
      expect(templatePhase.phase).toMatchObject({
        decisionMode: "deterministic",
        phase: "template",
        signalMode: "base-profile-only",
      });
      expect(templatePhase.outputPlan).toMatchObject({
        bundleId: outputPlan.identity.templateBundleId,
        templateHtml: outputPlan.templateHtml,
        styleCss: outputPlan.styleCss,
        report: outputPlan.report,
      });
      expect(templatePhase.signals.baseProfile.available).toBe(true);
      expect(templatePhase.signals.fonts.profileFonts.families).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            family: "Profile Body",
            key: "default",
            role: "body",
          }),
          expect.objectContaining({
            family: "Profile Japanese",
            key: "ja",
            role: "body",
          }),
          expect.objectContaining({
            family: "Profile Heading",
            key: "default",
            role: "heading",
          }),
          expect.objectContaining({
            family: "Profile Code",
            key: "default",
            role: "code",
          }),
          expect.objectContaining({
            family: "Profile Symbols",
            key: "symbols",
            role: "code",
          }),
        ]),
      );
      expect(templatePhase.signals.fonts.profileFonts.families).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ role: "pageChrome" })]),
      );
      expect(profilePhase.finalProfile).toMatchObject({
        fonts: {
          body: {
            default: "Profile Body",
            ja: "Profile Japanese",
          },
          heading: { default: "Profile Heading" },
          code: {
            default: "Profile Code",
            symbols: "Profile Symbols",
          },
          pageChrome: { default: "Profile Chrome" },
        },
      });
      expect(templatePhase.synthesis.templateFamily).toBe("document-layered");
      expect(templatePhase.synthesis.styleCss).toContain(
        '--template-body-font: "Noto Serif", "Georgia", serif;',
      );
      expect(templatePhase.synthesis.styleCss).toContain(
        '--template-heading-font: "Noto Sans", "Arial", sans-serif;',
      );
      expect(templatePhase.synthesis.styleCss).toContain(
        '--template-monospace-font: "Noto Sans Mono", "SFMono-Regular", "Consolas", monospace;',
      );
      expect(templatePhase.synthesis.styleCss).toContain("font-size: 10.5pt;");
      expect(templatePhase.synthesis.styleCss).toContain("line-height: 1.5;");
      expect(templatePhase.synthesis.styleCss).not.toContain(
        "font-family: var(--template-body-font);",
      );
      expect(templatePhase.synthesis.styleCss).not.toContain(
        "font-family: var(--template-heading-font);",
      );
      expect(templatePhase.synthesis.styleCss).not.toContain(
        "code {\n  font-family: var(--template-monospace-font);",
      );
      expect(templatePhase.synthesis.styleCss).not.toContain("Profile Chrome");
      expect(JSON.stringify(templatePhase)).not.toContain("fontOwnership");
      expect(JSON.stringify(templatePhase)).not.toContain("ownedKeys");
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("blocks ordinary template font decisions using the final project profile", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-font-ownership", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
          "  source: deterministic",
          "  createdAt: 2026-01-01T00:00:00Z",
          "fonts:",
          "  heading:",
          "    default: Profile Heading",
          "",
        ].join("\n"),
        "utf8",
      );

      const { outputPlan, templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
        baseProfile: "base.yml",
        intent: "apply custom CSS",
        profileCodexRunner: adaptedProfileRunner("base-profile"),
        templateCodexRunner: async () =>
          templateResponse({
            fontDecisions: [
              {
                family: "Suggested Body",
                key: "default",
                role: "body",
                source: "template-style",
                template_level: false,
              },
            ],
            recipeSource: "renderer-default",
          }),
      });

      expect(templatePhase.synthesis.fontDecisions).toEqual([
        expect.objectContaining({
          family: "Suggested Body",
          key: "default",
          overridesProfileFont: false,
          profileOwned: true,
          role: "body",
          status: "blocked",
        }),
      ]);
      expect(templatePhase.synthesis.styleCss).not.toContain("Suggested Body");
      expect(templatePhase.synthesis.styleCss).not.toContain(
        "font-family: var(--template-body-font);",
      );
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("keeps final-profile page numbers and page chrome private to Template coordination", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-template-private-page-profile",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "report.md"),
          "# Report\n\n```ts\nconst ok = true;\n```\n",
          "utf8",
        );
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "page:",
            "  size: Letter",
            "toc:",
            "  enabled: false",
            "code:",
            "  highlight: true",
            "  theme: github-light",
            "  lineNumbers: true",
            "  transformerNotation: false",
            "titleBlock:",
            "  metadataTitle: show",
            "header:",
            "  left: Private project header",
            "  style:",
            "    fontSize: 7.5pt",
            "    color: '#123ABC'",
            "    separator:",
            "      width: 0.7pt",
            "      style: solid",
            "      color: '#456DEF'",
            "      gap: 3mm",
            "footer:",
            "  right: Private project footer",
            "pageNumbers:",
            "  enabled: true",
            "  scope: body",
            "  countFrom: body",
            "  start: 17",
            "  increment: 3",
            "  position: top-right",
            "  format: 'Confidential {page} / {pages}'",
            "fonts:",
            "  body:",
            "    default: Private Body Font",
            "  code:",
            "    default: Private Code Font",
            "  pageChrome:",
            "    default: Private Chrome Font",
            "",
          ].join("\n"),
          "utf8",
        );

        let capturedFacts: Record<string, unknown> | undefined;
        const { outputPlan, profilePhase, templatePhase } = await runTemplatePhaseFixture(
          fixtureDir,
          {
            baseProfile: "base.yml",
            coverImage: "cover.png",
            input: "report.md",
            intent: "use a restrained cover treatment",
            profileCodexRunner: adaptedProfileRunner("base-profile"),
            templateCodexRunner: async ({ prompt }) => {
              capturedFacts = templatePromptFacts(prompt);
              return templateResponse({
                coverEnabled: true,
                recipePreset: "article",
                recipeSource: "renderer-default",
                templateFamily: "cover-media-layered",
              });
            },
          },
        );

        expect(profilePhase.finalProfile).toMatchObject({
          header: {
            left: "Private project header",
            style: {
              color: "#123ABC",
              fontSize: "7.5pt",
              separator: {
                color: "#456DEF",
                gap: "3mm",
                style: "solid",
                width: "0.7pt",
              },
            },
          },
          footer: { right: "Private project footer" },
          fonts: {
            body: { default: "Source Serif 4" },
            code: { default: "Private Code Font" },
            pageChrome: { default: "Private Chrome Font" },
          },
          pageNumbers: {
            countFrom: "body",
            enabled: true,
            format: "Confidential {page} / {pages}",
            increment: 3,
            position: "top-right",
            scope: "body",
            start: 17,
          },
        });
        expect(templatePhase.signals.baseProfile.summary?.fields).not.toContain("pageNumbers");
        expect(templatePhase.signals.baseProfile.summary?.traits).not.toHaveProperty("pageNumbers");
        expect(templatePhase.signals.baseProfile.summary?.traits).toMatchObject({
          codeHighlight: true,
          lineNumbers: true,
          toc: false,
        });
        expect(templatePhase.signals.recipe.effectiveOptions.toc).toBe(true);
        expect(templatePhase.signals.coverImage.available).toBe(true);
        expect(templatePhase.signals.fonts.profileFonts.families).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              family: "Source Serif 4",
              key: "default",
              role: "body",
            }),
            expect.objectContaining({
              family: "Private Code Font",
              key: "default",
              role: "code",
            }),
          ]),
        );
        expect(templatePhase.signals.fonts.profileFonts.families).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              family: "Private Chrome Font",
              role: "pageChrome",
            }),
          ]),
        );

        const serializedFacts = JSON.stringify(capturedFacts);
        const generatedTemplate = [
          templatePhase.synthesis.templateHtml,
          templatePhase.synthesis.styleCss,
        ].join("\n");
        for (const privateValue of [
          "pageNumbers",
          "Private project header",
          "Private project footer",
          "Confidential {page} / {pages}",
          "#123ABC",
          "#456DEF",
          "7.5pt",
          "0.7pt",
          "Private Chrome Font",
        ]) {
          expect(serializedFacts).not.toContain(privateValue);
          expect(generatedTemplate).not.toContain(privateValue);
        }
        expect(templatePhase.synthesis.managedAssets).toEqual([
          { role: "cover-image", bundlePath: "assets/cover.png", sourceBasename: "cover.png" },
        ]);
        expect(templatePhase.synthesis.templateHtml).toContain("$toc$");
        expect(templatePhase.synthesis.styleCss).toContain(".cdx-code-line");
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("uses full canonical ownership for overflow body languages and the combined code stack", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-template-full-font-ownership",
      async (fixtureDir) => {
        const precedingLanguageFonts = [
          "aa",
          "ab",
          "af",
          "ak",
          "am",
          "ar",
          "as",
          "az",
          "ba",
          "be",
          "bg",
          "bn",
          "bo",
          "br",
          "bs",
          "ca",
          "cs",
          "cy",
          "da",
          "de",
        ].map((language, index) => `    ${language}: Profile Language ${index}`);
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "fonts:",
            "  body:",
            ...precedingLanguageFonts,
            "    zh-Hant: Profile Traditional Chinese",
            "  code:",
            "    symbols: Profile Symbols",
            "",
          ].join("\n"),
          "utf8",
        );

        const { outputPlan, templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
          intent: "apply custom CSS",
          profileCodexRunner: adaptedProfileRunner("base-profile"),
          templateCodexRunner: async () =>
            templateResponse({
              fontDecisions: [
                {
                  family: "Suggested Traditional Chinese",
                  key: "ZH-hant",
                  role: "body",
                  source: "template-style",
                  template_level: false,
                },
                {
                  family: "Suggested Code",
                  key: "default",
                  role: "code",
                  source: "template-style",
                  template_level: false,
                },
              ],
              recipeSource: "renderer-default",
            }),
        });

        expect(templatePhase.signals.fonts.profileFonts.overflowFamilyCount).toBeGreaterThan(0);
        expect(templatePhase.synthesis.fontDecisions).toEqual([
          expect.objectContaining({
            key: "zh-Hant",
            profileOwned: true,
            reason: "profile-font-owned",
            role: "body",
            status: "blocked",
          }),
          expect.objectContaining({
            key: "default",
            profileOwned: true,
            reason: "profile-font-owned",
            role: "code",
            status: "blocked",
          }),
        ]);
        expect(templatePhase.synthesis.styleCss).not.toContain("Suggested Traditional Chinese");
        expect(templatePhase.synthesis.styleCss).not.toContain("Suggested Code");
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("rejects hidden font-family declarations from project CSS blocks", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-template-hidden-font-family",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

        const { templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
          input: "report.md",
          intent: "apply custom CSS",
          profileCodexRunner: adaptedProfileRunner(),
          templateCodexRunner: async () =>
            templateResponse({
              cssBlocks: [
                {
                  css: "body { f\\6f nt-family: Hidden Family; }",
                  slot: "typography",
                },
              ],
              recipeSource: "renderer-default",
            }),
        });

        expect(templatePhase.phase).toMatchObject({
          decisionMode: "no-usable-project",
          phase: "template",
        });
        expect(templatePhase.synthesis.styleCss).toBe("");
        expect(templatePhase.synthesis.templateHtml).toBe("");
      },
    );
  });

  test("materializes cover-image-only deterministic template results with project managed assets", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-cover-only", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));

      const { outputPlan, templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
        coverImage: "cover.png",
      });

      expect(templatePhase.phase).toMatchObject({
        decisionMode: "deterministic",
        phase: "template",
        signalMode: "cover-image-only",
      });
      expect(templatePhase.outputPlan.assets).toEqual(outputPlan.assets);
      expect(templatePhase.outputPlan.assets[0]).toMatchObject({
        bundlePath: "assets/cover.png",
        sourceBasename: "cover.png",
      });
      expect(templatePhase.synthesis.templateFamily).toBe("cover-media-layered");
      expect(templatePhase.synthesis.managedAssets).toEqual([
        { role: "cover-image", bundlePath: "assets/cover.png", sourceBasename: "cover.png" },
      ]);
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("keeps combined base-profile and cover-image paths deterministic", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-combined", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
          "  source: deterministic",
          "  createdAt: 2026-01-01T00:00:00Z",
          "page:",
          "  size: Letter",
          "fonts:",
          "  body:",
          "    default: Profile Body",
          "  heading:",
          "    default: Profile Heading",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      let templateRunnerCallCount = 0;

      const { outputPlan, templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
        baseProfile: "base.yml",
        coverImage: "cover.png",
        templateCodexRunner: async () => {
          templateRunnerCallCount += 1;
          throw new Error("deterministic template phase must not invoke Codex");
        },
      });

      expect(templateRunnerCallCount).toBe(0);
      expect(templatePhase.phase).toMatchObject({
        decisionMode: "deterministic",
        phase: "template",
        signalMode: "deterministic",
      });
      expect(templatePhase.synthesis.templateFamily).toBe("cover-media-layered");
      expect(templatePhase.synthesis.styleCss).not.toContain(
        "font-family: var(--template-heading-font);",
      );
      expect(templatePhase.synthesis.styleCss).toContain(
        "font: 700 22pt/1.15 var(--template-heading-font);",
      );
      expect(templatePhase.synthesis.styleCss).toContain(
        "font: 12pt/1.35 var(--template-body-font);",
      );
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("does not escalate template Codex for profile-assisted plain Markdown", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-template-profile-assisted",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
        let templateRunnerCallCount = 0;

        const { outputPlan, profilePhase, templatePhase } = await runTemplatePhaseFixture(
          fixtureDir,
          {
            input: "report.md",
            intent: "plain report",
            profileCodexRunner: adaptedProfileRunner("article"),
            templateCodexRunner: async () => {
              templateRunnerCallCount += 1;
              throw new Error("plain Markdown template phase must not invoke Codex");
            },
          },
        );

        expect(profilePhase.phase).toMatchObject({
          decisionMode: "adapted",
          signalMode: "document-informed",
        });
        expect(profilePhase.unmatchedProfileDirections).toEqual([]);
        expect(templateRunnerCallCount).toBe(0);
        expect(templatePhase.phase).toMatchObject({
          decisionMode: "deterministic",
          phase: "template",
          signalMode: "deterministic",
        });
        expect(templatePhase.synthesis.templateFamily).toBe("document-layered");
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("runs template Codex for document table signals while preserving profile recipe ownership", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-table-signal", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "wide-table.md"),
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
      let templateRunnerCallCount = 0;
      let capturedFacts: Record<string, unknown> | undefined;
      let capturedWorkingDirectory: string | undefined;

      const { outputPlan, profilePhase, stderr, templatePhase } = await runTemplatePhaseFixture(
        fixtureDir,
        {
          input: "wide-table.md",
          profileCodexRunner: adaptedProfileRunner("wide-table"),
          stderrIsTTY: true,
          templateCodexRunner: async ({ prompt, workingDirectory }) => {
            templateRunnerCallCount += 1;
            capturedFacts = templatePromptFacts(prompt);
            capturedWorkingDirectory = workingDirectory;
            return templateResponse({
              coverEnabled: false,
              recipePreset: "wide-table",
              recipeSource: "base-profile",
              templateFamily: "document-layered",
            });
          },
        },
      );

      expect(profilePhase.unmatchedProfileDirections).toEqual([]);
      expect(templateRunnerCallCount).toBe(1);
      expect(capturedWorkingDirectory).toBe(fixtureDir);
      expect(stderr.text).toContain(
        "Requesting Codex Markdown PDF project template recommendation...",
      );
      expect(stderr.text).toContain(
        "Requesting Codex Markdown PDF project template recommendation... done",
      );
      expect(templatePhase.phase).toMatchObject({
        decisionMode: "adapted",
        phase: "template",
        signalMode: "codex-assisted",
      });
      expect(templatePhase.signals.recipe.layoutPolicy.tableLayoutSignal.level).toBe("strong");
      expect(templatePhase.signals.baseProfile.summary).toMatchObject({
        basedOn: "wide-table",
        id: profilePhase.identity.id,
        label: "Final project profile",
        preset: "wide-table",
        presetBacked: true,
      });
      expect(templatePhase.synthesis.slots.recipePreset).toMatchObject({
        preset: "wide-table",
        source: "base-profile",
      });
      expect(capturedFacts).toMatchObject({
        signalMode: "codex-assisted",
        layoutDecisionPolicy: {
          tableLayoutSignal: {
            level: "strong",
          },
          schemaRecipePresetSource: "base-profile",
        },
      });
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("preserves conservative-fallback template outcomes and TTY progress status", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-fallback", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

      const { outputPlan, stderr, templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
        input: "report.md",
        profileCodexRunner: adaptedProfileRunner("article", ["custom template spacing"]),
        stderrIsTTY: true,
        templateCodexRunner: async () =>
          templateResponse({
            coverEnabled: false,
            decisionMode: "conservative-fallback",
            fallbackReason: "Template spacing request reduced to bounded defaults.",
            recipePreset: "article",
            recipeSource: "base-profile",
            templateFamily: "document-layered",
          }),
      });

      expect(templatePhase.phase).toMatchObject({
        decisionMode: "conservative-fallback",
        fallbackReason: "Template spacing request reduced to bounded defaults.",
        phase: "template",
        signalMode: "codex-assisted",
      });
      expect(stderr.text).toContain(
        "Requesting Codex Markdown PDF project template recommendation... fallback",
      );
      expect(templatePhase.synthesis.templateFamily).toBe("document-layered");
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("maps no-usable template outcomes to no-usable project phase summaries", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

      const { outputPlan, stderr, templatePhase } = await runTemplatePhaseFixture(fixtureDir, {
        input: "report.md",
        profileCodexRunner: adaptedProfileRunner("article", ["fetch a remote template"]),
        stderrIsTTY: true,
        templateCodexRunner: async () =>
          noUsableTemplateResponse("Remote template fetching is not supported."),
      });

      expect(templatePhase.phase).toMatchObject({
        decisionMode: "no-usable-project",
        fallbackReason: "Remote template fetching is not supported.",
        phase: "template",
        signalMode: "codex-assisted",
      });
      expect(templatePhase.synthesis).toMatchObject({
        decisionMode: "no-usable-template",
        styleCss: "",
        templateHtml: "",
      });
      expect(stderr.text).toContain(
        "Requesting Codex Markdown PDF project template recommendation... error",
      );
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("runs template Codex for forwarded profile directions in the current read-only workspace", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-forwarded", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

      let capturedCodexOptions: unknown;
      let capturedThreadOptions: unknown;
      let capturedRunMessages: unknown;
      let capturedRunOptions: unknown;
      const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
      const timeoutCalls: number[] = [];
      if (!originalTimeoutDescriptor || typeof originalTimeoutDescriptor.value !== "function") {
        throw new Error("AbortSignal.timeout is not available");
      }
      const originalTimeout = originalTimeoutDescriptor.value as typeof AbortSignal.timeout;
      Object.defineProperty(AbortSignal, "timeout", {
        ...originalTimeoutDescriptor,
        value: (milliseconds: number) => {
          timeoutCalls.push(milliseconds);
          return originalTimeout.call(AbortSignal, milliseconds);
        },
      });
      mock.module("@openai/codex-sdk", () => ({
        Codex: class {
          constructor(options: unknown) {
            capturedCodexOptions = options;
          }

          startThread(options: unknown) {
            capturedThreadOptions = options;
            return {
              run: async (messages: unknown, options: unknown) => {
                capturedRunMessages = messages;
                capturedRunOptions = options;
                return {
                  finalResponse: templateResponse({
                    coverEnabled: false,
                    recipePreset: "article",
                    recipeSource: "base-profile",
                    templateFamily: "document-layered",
                  }),
                };
              },
            };
          }
        },
      }));

      let result: Awaited<ReturnType<typeof runTemplatePhaseFixture>>;
      try {
        result = await runTemplatePhaseFixture(fixtureDir, {
          input: "report.md",
          intent: "plain report",
          profileCodexRunner: adaptedProfileRunner("article", ["custom callout CSS"]),
        });
      } finally {
        Object.defineProperty(AbortSignal, "timeout", originalTimeoutDescriptor);
      }

      const threadOptions = capturedThreadOptions as {
        approvalPolicy: string;
        modelReasoningEffort: string;
        networkAccessEnabled: boolean;
        sandboxMode: string;
        webSearchMode: string;
        workingDirectory: string;
      };
      const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
      const runOptions = capturedRunOptions as { outputSchema: unknown; signal: AbortSignal };
      const facts = templatePromptFacts(runMessages[0]?.text ?? "");
      const intentFact = String(facts.intent);

      expect(result.templatePhase.forwardedProfileDirections).toEqual(["custom callout CSS"]);
      expect(result.templatePhase.phase).toMatchObject({
        decisionMode: "adapted",
        phase: "template",
        signalMode: "codex-assisted",
      });
      expect(result.templatePhase.synthesis.templateFamily).toBe("document-layered");
      expect(threadOptions).toMatchObject({
        approvalPolicy: "never",
        modelReasoningEffort: "low",
        networkAccessEnabled: true,
        sandboxMode: "read-only",
        webSearchMode: "disabled",
      });
      expect(threadOptions.workingDirectory).toBe(fixtureDir);
      expect(capturedCodexOptions).toEqual({});
      expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA);
      expect(runOptions.signal).toBeInstanceOf(AbortSignal);
      expect(timeoutCalls).toEqual([MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS]);
      expect(facts).toMatchObject({
        intent: expect.stringContaining("Forwarded profile directions:"),
        signalMode: "codex-assisted",
        outputPlan: {
          bundleId: result.outputPlan.identity.templateBundleId,
          files: {
            styleCss: "style.css",
            templateHtml: "template.html",
          },
        },
      });
      expect(intentFact).toContain("custom callout CSS");
      await expectNoPlannedProjectArtifacts(result.outputPlan);
    });
  });

  test("does not forward template-owned cover directions from the profile phase", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-template-cover-owned-not-forwarded",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nCover body.\n", "utf8");
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 1800));

        let capturedFacts: Record<string, unknown> | undefined;
        const result = await runTemplatePhaseFixture(fixtureDir, {
          coverImage: "cover.png",
          input: "report.md",
          intent: "cover page uses the cover image first",
          profileCodexRunner: adaptedProfileRunner("article", ["cover image first"]),
          templateCodexRunner: async ({ prompt }) => {
            capturedFacts = templatePromptFacts(prompt);
            return templateResponse({
              coverEnabled: true,
              recipePreset: "article",
              recipeSource: "base-profile",
              templateFamily: "cover-media-layered",
            });
          },
        });

        expect(result.profilePhase.unmatchedProfileDirections).toEqual([]);
        expect(result.templatePhase.forwardedProfileDirections).toEqual([]);
        expect(result.templatePhase.phase).toMatchObject({
          decisionMode: "adapted",
          phase: "template",
          signalMode: "codex-assisted",
        });
        expect(String(capturedFacts?.intent)).toBe("cover page uses the cover image first");
        expect(String(capturedFacts?.intent)).not.toContain("Forwarded profile directions:");
        expect(result.templatePhase.synthesis.templateFamily).toBe("cover-media-layered");
        await expectNoPlannedProjectArtifacts(result.outputPlan);
      },
    );
  });
});
