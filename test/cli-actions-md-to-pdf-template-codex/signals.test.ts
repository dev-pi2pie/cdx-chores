import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  assertUsableMdPdfTemplateCodexSignalMode,
  classifyMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
} from "../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalJpeg, minimalPng, minimalWebpVp8xSquare1200 } from "./fixtures";

describe("cli action modules: md pdf-template codex signals", () => {
  test("classifies the Phase 2 signal ladder", () => {
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("low-signal");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("base-profile-only");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: false,
        hasRecipeFlags: true,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("recipe-only");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("cover-image-only");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("deterministic");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: true,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: true,
        hasInput: false,
        hasIntent: true,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: true,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: false,
      }),
    ).toBe("no-usable-template");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: false,
        hasInput: true,
        hasIntent: false,
        hasRecipeFlags: false,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: false,
        hasCoverImage: false,
        hasInput: false,
        hasIntent: true,
        hasRecipeFlags: true,
        hasUsableTemplateCandidate: true,
      }),
    ).toBe("codex-assisted");
    expect(
      classifyMdPdfTemplateCodexSignalMode({
        hasBaseProfile: true,
        hasCoverImage: true,
        hasInput: true,
        hasIntent: true,
        hasRecipeFlags: true,
        hasUsableTemplateCandidate: false,
      }),
    ).toBe("no-usable-template");
  });

  test("rejects no-usable-template as a distinct failure mode", async () => {
    await expectCliError(
      async () => assertUsableMdPdfTemplateCodexSignalMode("no-usable-template"),
      {
        code: "NO_USABLE_TEMPLATE",
        exitCode: 1,
        messageIncludes: "No usable Markdown PDF template path",
      },
    );
  });

  test("collects Markdown, recipe, and font signals for Codex-assisted input", async () => {
    await withTempFixtureDir("md-pdf-template-codex-document-signals", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(
        inputPath,
        [
          "---",
          "title: Private Report",
          "---",
          "# Private Report",
          "## Findings",
          "![chart](./private/chart.png)",
          "| A | B | C |",
          "| - | - | - |",
          "| 1 | 2 | 3 |",
          "```ts",
          "const secret = true;",
          "```",
        ].join("\n"),
        "utf8",
      );

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        fontHint: [" Inter ", "Noto Sans"],
        toc: true,
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const serialized = JSON.stringify(signals);

      expect(signals.signalMode).toBe("codex-assisted");
      expect(signals.documentSignals.available).toBe(true);
      expect(signals.documentSignals.headings).toMatchObject({ total: 2, maxDepth: 2 });
      expect(signals.documentSignals.tables.maxColumns).toBe(3);
      expect(signals.documentSignals.codeFences.languages).toEqual(["ts"]);
      expect(signals.documentSignals.assets).toEqual({
        localCount: 1,
        remoteCount: 0,
        dataUriCount: 0,
      });
      expect(signals.documentSignals.title.duplicateVisibleTitleRisk).toBe(true);
      expect(signals.recipe.explicitFields).toEqual(["toc"]);
      expect(signals.recipe.effectiveOptions.toc).toBe(true);
      expect(signals.fonts.hints).toEqual(["Inter", "Noto Sans"]);
      expect(signals.fonts.profileFonts.families.length).toBeGreaterThan(0);
      expect(serialized).not.toContain("Private Report");
      expect(serialized).not.toContain("./private/chart.png");
      expect(serialized).not.toContain("secret");
    });
  });

  test("uses base profile recipe fields and lets explicit recipe flags take precedence", async () => {
    await withTempFixtureDir("md-pdf-template-codex-base-profile-signals", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "profile.yml");
      await writeFile(
        baseProfilePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260618T010203Z-a1b2c3d4",
          "  source: codex",
          "  preset: wide-table",
          "  createdAt: 2026-06-18T01:02:03Z",
          "page:",
          "  size: Letter",
          "  orientation: landscape",
          "toc:",
          "  enabled: true",
          "  depth: 4",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        baseProfile: toRepoRelativePath(baseProfilePath),
        orientation: "portrait",
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      expect(signals.signalMode).toBe("deterministic");
      expect(signals.baseProfile).toMatchObject({
        available: true,
        summary: {
          kind: "base-profile",
          preset: "wide-table",
        },
      });
      expect(signals.recipe.baseProfileFields).toEqual([
        "orientation",
        "pageSize",
        "preset",
        "toc",
        "tocDepth",
      ]);
      expect(signals.recipe.explicitFields).toEqual(["orientation"]);
      expect(signals.recipe.effectiveOptions.pageSize).toBe("Letter");
      expect(signals.recipe.effectiveOptions.orientation).toBe("portrait");
      expect(signals.recipe.effectiveOptions.toc).toBe(true);
      expect(signals.recipe.effectiveOptions.tocDepth).toBe(4);
    });
  });

  test("collects cover image dimensions, orientation, and fit-pressure signals", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cover-signals", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "cover.png");
      await writeFile(coverImagePath, minimalPng(4000, 1000));

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(coverImagePath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      expect(signals.signalMode).toBe("cover-image-only");
      expect(signals.coverImage).toMatchObject({
        available: true,
        sourceBasename: "cover.png",
        format: "png",
        metadataStatus: "parsed",
        dimensions: { width: 4000, height: 1000 },
        aspectRatio: 4,
        orientationBucket: "panoramic",
        fitPressure: "letterbox-risk",
      });
      expect(JSON.stringify(signals.coverImage)).not.toContain(fixtureDir);
    });
  });

  test("collects JPEG and WebP cover metadata across orientation buckets", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cover-format-signals", async (fixtureDir) => {
      const jpegPath = join(fixtureDir, "cover.jpg");
      const webpPath = join(fixtureDir, "cover.webp");
      await writeFile(jpegPath, minimalJpeg(800, 2000));
      await writeFile(webpPath, minimalWebpVp8xSquare1200());

      const { runtime } = createActionTestRuntime();
      const jpegState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(jpegPath),
      });
      const webpState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(webpPath),
      });
      const [jpegSignals, webpSignals] = await Promise.all([
        collectMdPdfTemplateCodexSignals(runtime, jpegState),
        collectMdPdfTemplateCodexSignals(runtime, webpState),
      ]);

      expect(jpegSignals.coverImage).toMatchObject({
        available: true,
        sourceBasename: "cover.jpg",
        format: "jpeg",
        metadataStatus: "parsed",
        dimensions: { width: 800, height: 2000 },
        orientationBucket: "tall",
        fitPressure: "crop-risk",
      });
      expect(webpSignals.coverImage).toMatchObject({
        available: true,
        sourceBasename: "cover.webp",
        format: "webp",
        metadataStatus: "parsed",
        dimensions: { width: 1200, height: 1200 },
        orientationBucket: "square",
        fitPressure: "normal",
      });
    });
  });

  test("keeps supported but unparseable cover images available with unknown dimensions", async () => {
    await withTempFixtureDir("md-pdf-template-codex-unparseable-cover", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "cover.png");
      await writeFile(coverImagePath, "not really a png", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(coverImagePath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      expect(signals.coverImage).toEqual({
        available: true,
        sourceBasename: "cover.png",
        format: "png",
        metadataStatus: "unparsed",
        orientationBucket: "unknown",
        fitPressure: "unknown",
      });
    });
  });
});
