import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
} from "../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalJpeg, minimalPng, minimalWebpVp8xSquare1200 } from "./fixtures";

describe("cli action modules: md pdf-template codex signal collection", () => {
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

  test("derives wide-table recipe from strong table signals when no page recipe owner exists", async () => {
    await withTempFixtureDir("md-pdf-template-codex-wide-table-signals", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "wide-report.md");
      await writeFile(
        inputPath,
        [
          "# Wide Report",
          "",
          "| Alpha | Beta | Gamma | Delta | Epsilon | Zeta | Eta | Theta |",
          "| - | - | - | - | - | - | - | - |",
          "| 100000000000000 | 200000000000000 | 300000000000000 | 400000000000000 | 500000000000000 | 600000000000000 | 700000000000000 | 800000000000000 |",
        ].join("\n"),
        "utf8",
      );

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      expect(signals.recipe.layoutPolicy.tableLayoutSignal.level).toBe("strong");
      expect(signals.recipe.layoutPolicy.recipePreset).toMatchObject({
        status: "applied",
        source: "document-table-signal",
        preset: "wide-table",
      });
      expect(signals.recipe.effectiveOptions.preset).toBe("wide-table");
      expect(signals.recipe.effectiveOptions.orientation).toBe("landscape");
      expect(signals.recipe.effectiveOptions.margins).toEqual({
        top: "12mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm",
      });
    });
  });

  test("keeps weak table signals from forcing landscape", async () => {
    await withTempFixtureDir("md-pdf-template-codex-weak-table-signals", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "weak-table.md");
      await writeFile(
        inputPath,
        [
          "# Table",
          "",
          "| A | B | C | D | E |",
          "| - | - | - | - | - |",
          "| 1 | 2 | 3 | 4 | 5 |",
        ].join("\n"),
        "utf8",
      );

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      expect(signals.recipe.layoutPolicy.tableLayoutSignal.level).toBe("weak");
      expect(signals.recipe.layoutPolicy.recipePreset).toMatchObject({
        status: "not-needed",
        source: "document-table-signal",
      });
      expect(signals.recipe.effectiveOptions.preset).toBe("article");
      expect(signals.recipe.effectiveOptions.orientation).toBe("portrait");
    });
  });

  test("blocks document-derived wide-table when a base profile owns page recipe settings", async () => {
    await withTempFixtureDir("md-pdf-template-codex-wide-table-owned", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "wide-report.md");
      const baseProfilePath = join(fixtureDir, "profile.yml");
      await writeFile(
        inputPath,
        [
          "# Wide Report",
          "",
          "| Alpha | Beta | Gamma | Delta | Epsilon | Zeta | Eta | Theta |",
          "| - | - | - | - | - | - | - | - |",
          "| 100000000000000 | 200000000000000 | 300000000000000 | 400000000000000 | 500000000000000 | 600000000000000 | 700000000000000 | 800000000000000 |",
        ].join("\n"),
        "utf8",
      );
      await writeFile(baseProfilePath, "page:\n  orientation: portrait\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        baseProfile: toRepoRelativePath(baseProfilePath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      expect(signals.recipe.layoutPolicy.tableLayoutSignal.level).toBe("strong");
      expect(signals.recipe.layoutPolicy.recipePreset).toMatchObject({
        status: "blocked",
        source: "document-table-signal",
        preset: "wide-table",
        blockedBy: "base-profile",
      });
      expect(signals.recipe.effectiveOptions.preset).toBe("article");
      expect(signals.recipe.effectiveOptions.orientation).toBe("portrait");
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
