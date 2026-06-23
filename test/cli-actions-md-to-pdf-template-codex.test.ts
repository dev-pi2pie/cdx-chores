import { describe, expect, test } from "bun:test";
import { stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateCodex } from "../src/cli/actions/markdown";
import {
  assertUsableMdPdfTemplateCodexSignalMode,
  classifyMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
} from "../src/cli/markdown-pdf/template-codex";
import { readTemplateCodexCoverImageMetadata } from "../src/cli/markdown-pdf/template-codex/image-metadata";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function minimalPng(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function minimalJpeg(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0], 0);
  bytes.writeUInt16BE(17, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

const WEBP_FILE_HEADER_LENGTH = 12;
const WEBP_CHUNK_HEADER_LENGTH = 8;
const WEBP_CHUNK_SIZE_OFFSET = 4;

function minimalWebpWithChunks(
  chunks: Array<{ type: string; payload: Buffer }>,
  riffSignature = "RIFF",
  webpSignature = "WEBP",
): Buffer {
  const chunkBytes = chunks.map(({ type, payload }) => {
    const bytes = Buffer.alloc(WEBP_CHUNK_HEADER_LENGTH + payload.length + (payload.length % 2));
    bytes.write(type, 0, "ascii");
    bytes.writeUInt32LE(payload.length, WEBP_CHUNK_SIZE_OFFSET);
    payload.copy(bytes, WEBP_CHUNK_HEADER_LENGTH);
    return bytes;
  });
  const bytes = Buffer.concat([Buffer.alloc(WEBP_FILE_HEADER_LENGTH), ...chunkBytes]);
  bytes.write(riffSignature, 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write(webpSignature, 8, "ascii");
  return bytes;
}

function minimalWebpVp8xSquare1200(): Buffer {
  // VP8X canvas fields store 1199x1199 for a 1200x1200 image.
  return minimalWebpWithChunks([
    { type: "VP8X", payload: Buffer.from([0, 0, 0, 0, 0xaf, 0x04, 0, 0xaf, 0x04, 0]) },
  ]);
}

function minimalWebpVp8x1200By800(): Buffer {
  // VP8X canvas fields store 1199x799 for a 1200x800 image.
  return minimalWebpWithChunks([
    { type: "VP8X", payload: Buffer.from([0, 0, 0, 0, 0xaf, 0x04, 0, 0x1f, 0x03, 0]) },
  ]);
}

function minimalWebpVp8x900By300Payload(): Buffer {
  // VP8X canvas fields store 899x299 for a 900x300 image.
  return Buffer.from([0, 0, 0, 0, 0x83, 0x03, 0, 0x2b, 0x01, 0]);
}

function minimalWebpVp8Lossy640By480(): Buffer {
  // VP8 lossy frame header stores direct 640x480 dimensions at payload offsets 6 and 8.
  return minimalWebpWithChunks([
    { type: "VP8 ", payload: Buffer.from([0, 0, 0, 0, 0, 0, 0x80, 0x02, 0xe0, 0x01]) },
  ]);
}

function minimalWebpVp8lLossless321By654(): Buffer {
  // VP8L stores 320x653 as packed 14-bit values after the 0x2f lossless signature.
  return minimalWebpWithChunks([
    { type: "VP8L", payload: Buffer.from([0x2f, 0x40, 0x41, 0xa3, 0]) },
  ]);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("cli action modules: md pdf-template codex", () => {
  test("normalizes inputs, hints, report output, and recipe flags", async () => {
    await withTempFixtureDir("md-pdf-template-codex-options", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const baseProfilePath = join(fixtureDir, "profile.yml");
      const coverImagePath = join(fixtureDir, "cover.png");
      const outputPath = join(fixtureDir, "pdf-template");
      const reportPath = join(fixtureDir, "template-codex-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");
      await writeFile(coverImagePath, "not really an image yet\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "  client report  ",
        fontHint: ["  Inter  ", " ", "Noto Sans CJK"],
        baseProfile: toRepoRelativePath(baseProfilePath),
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        preset: "report",
        pageSize: "Letter",
        toc: true,
        tocDepth: 2,
        overwrite: true,
      });

      expect(state.inputPath).toBe(inputPath);
      expect(state.intent).toBe("client report");
      expect(state.fontHints).toEqual(["Inter", "Noto Sans CJK"]);
      expect(state.baseProfilePath).toBe(baseProfilePath);
      expect(state.coverImagePath).toBe(coverImagePath);
      expect(state.outputPath).toBe(outputPath);
      expect(state.codexReportOutputPath).toBe(reportPath);
      expect(state.keepCodexReport).toBe(true);
      expect(state.overwrite).toBe(true);
      expect(state.recipeOptions.preset).toBe("report");
      expect(state.recipeOptions.pageSize).toBe("Letter");
      expect(state.recipeOptions.toc).toBe(true);
      expect(state.recipeOptions.tocDepth).toBe(2);
      expect(state.explicitRecipe.fields).toEqual(["pageSize", "preset", "toc", "tocDepth"]);
      expect(state.explicitRecipe.options).toMatchObject({
        pageSize: "Letter",
        preset: "report",
        toc: true,
        tocDepth: 2,
      });
    });
  });

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

  test("allows positional input and --input when they resolve to the same file", async () => {
    await withTempFixtureDir("md-pdf-template-codex-same-input", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        positionalInput: toRepoRelativePath(inputPath),
        input: toRepoRelativePath(inputPath),
      });

      expect(state.inputPath).toBe(inputPath);
    });
  });

  test("allows positional input and --input when they resolve to the same file identity", async () => {
    await withTempFixtureDir("md-pdf-template-codex-symlink-input", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const aliasPath = join(fixtureDir, "report-alias.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      await symlink(inputPath, aliasPath);

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        positionalInput: toRepoRelativePath(aliasPath),
        input: toRepoRelativePath(inputPath),
      });

      expect(state.inputPath).toBe(inputPath);
    });
  });

  test("rejects invalid base profiles during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-invalid-profile", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "profile.yml");
      await writeFile(baseProfilePath, "unknown: true\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            baseProfile: toRepoRelativePath(baseProfilePath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown Markdown PDF profile key",
        },
      );
    });
  });

  test("rejects missing base profile files during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-missing-profile", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            baseProfile: toRepoRelativePath(join(fixtureDir, "missing-profile.yml")),
          }),
        {
          code: "FILE_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "Base profile file not found",
        },
      );
    });
  });

  test("rejects malformed base profile files during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-malformed-profile", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "profile.yml");
      await writeFile(baseProfilePath, "page: [\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            baseProfile: toRepoRelativePath(baseProfilePath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Failed to parse Markdown PDF profile YAML",
        },
      );
    });
  });

  test("rejects unsupported cover image formats during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-invalid-cover", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "cover.gif");
      await writeFile(coverImagePath, "gif\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            coverImage: toRepoRelativePath(coverImagePath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Cover image must be a local PNG, JPEG, or WebP file.",
        },
      );
    });
  });

  test("rejects missing cover image files during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-missing-cover", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            coverImage: toRepoRelativePath(join(fixtureDir, "missing-cover.png")),
          }),
        {
          code: "FILE_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "Cover image file not found",
        },
      );
    });
  });

  test("rejects non-local cover image resources before signal collection", async () => {
    const { runtime } = createActionTestRuntime();
    await expectCliError(
      () =>
        normalizeMdPdfTemplateCodexCommandState(runtime, {
          coverImage: "https://example.com/cover.png",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Cover image must be a local PNG, JPEG, or WebP file.",
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

  test("parses WebP dimensions from VP8X, VP8, VP8L, and padded chunks", async () => {
    await withTempFixtureDir("md-pdf-template-codex-webp-variants", async (fixtureDir) => {
      const vp8xPath = join(fixtureDir, "extended.webp");
      const vp8Path = join(fixtureDir, "lossy.webp");
      const vp8lPath = join(fixtureDir, "lossless.webp");
      const paddedPath = join(fixtureDir, "padded.webp");
      await writeFile(vp8xPath, minimalWebpVp8x1200By800());
      await writeFile(vp8Path, minimalWebpVp8Lossy640By480());
      await writeFile(vp8lPath, minimalWebpVp8lLossless321By654());
      await writeFile(
        paddedPath,
        minimalWebpWithChunks([
          { type: "JUNK", payload: Buffer.from([0x01]) },
          { type: "VP8X", payload: minimalWebpVp8x900By300Payload() },
        ]),
      );

      await expect(readTemplateCodexCoverImageMetadata(vp8xPath, "webp")).resolves.toEqual({
        status: "parsed",
        dimensions: { width: 1200, height: 800 },
      });
      await expect(readTemplateCodexCoverImageMetadata(vp8Path, "webp")).resolves.toEqual({
        status: "parsed",
        dimensions: { width: 640, height: 480 },
      });
      await expect(readTemplateCodexCoverImageMetadata(vp8lPath, "webp")).resolves.toEqual({
        status: "parsed",
        dimensions: { width: 321, height: 654 },
      });
      await expect(readTemplateCodexCoverImageMetadata(paddedPath, "webp")).resolves.toEqual({
        status: "parsed",
        dimensions: { width: 900, height: 300 },
      });
    });
  });

  test("treats malformed WebP metadata as unparsed", async () => {
    await withTempFixtureDir("md-pdf-template-codex-webp-malformed", async (fixtureDir) => {
      const shortPath = join(fixtureDir, "short.webp");
      const wrongMagicPath = join(fixtureDir, "wrong-magic.webp");
      const undersizedPath = join(fixtureDir, "undersized.webp");
      const truncatedPath = join(fixtureDir, "truncated.webp");
      await writeFile(shortPath, Buffer.from("RIFFWEBP"));
      await writeFile(
        wrongMagicPath,
        minimalWebpWithChunks([{ type: "VP8X", payload: Buffer.alloc(10) }], "NOPE"),
      );
      await writeFile(
        undersizedPath,
        minimalWebpWithChunks([{ type: "VP8X", payload: Buffer.alloc(9) }]),
      );
      await writeFile(
        truncatedPath,
        Buffer.concat([
          minimalWebpWithChunks([{ type: "VP8X", payload: Buffer.alloc(10) }]).subarray(0, 25),
        ]),
      );

      await expect(readTemplateCodexCoverImageMetadata(shortPath, "webp")).resolves.toEqual({
        status: "unparsed",
      });
      await expect(readTemplateCodexCoverImageMetadata(wrongMagicPath, "webp")).resolves.toEqual({
        status: "unparsed",
      });
      await expect(readTemplateCodexCoverImageMetadata(undersizedPath, "webp")).resolves.toEqual({
        status: "unparsed",
      });
      await expect(readTemplateCodexCoverImageMetadata(truncatedPath, "webp")).resolves.toEqual({
        status: "unparsed",
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

  test("normalizes output paths without requiring the directory to exist in Phase 1", async () => {
    await withTempFixtureDir("md-pdf-template-codex-output-path", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "new-template-dir");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(outputPath),
      });

      expect(state.outputPath).toBe(outputPath);
    });
  });

  test("rejects low-signal runs before output planning without writing artifacts", async () => {
    await withTempFixtureDir("md-pdf-template-codex-low-signal", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      const { runtime, stdout } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfTemplateCodex(runtime, {
            intent: "   ",
            output: toRepoRelativePath(outputPath),
            codexReportOutput: toRepoRelativePath(reportPath),
          }),
        {
          code: "LOW_SIGNAL",
          exitCode: 2,
          messageIncludes: "Not enough signal",
        },
      );

      expect(stdout.text).toBe("");
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(reportPath)).toBe(false);
    });
  });

  test("collects command signals before the Phase 3 boundary", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-boundary", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionMdPdfTemplateCodex(runtime, {
            input: toRepoRelativePath(inputPath),
            intent: "dense report",
          }),
        {
          code: "NOT_IMPLEMENTED",
          exitCode: 1,
          messageIncludes: "output planning begins in Phase 3",
        },
      );
      expect(stdout.text).toContain("Signal mode: codex-assisted");
    });
  });
});
