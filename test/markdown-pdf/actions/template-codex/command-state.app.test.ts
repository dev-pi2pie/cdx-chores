import { describe, expect, test } from "bun:test";
import { symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeMdPdfTemplateCodexCommandState } from "../../../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { minimalWebpWithChunks } from "../template-codex-fixtures";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, payload: Buffer): Buffer {
  const bytes = Buffer.alloc(12 + payload.length);
  bytes.writeUInt32BE(payload.length, 0);
  bytes.write(type, 4, "ascii");
  payload.copy(bytes, 8);
  return bytes;
}

function minimalAnimatedPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("acTL", Buffer.alloc(8))]);
}

function minimalAnimatedWebp(): Buffer {
  return minimalWebpWithChunks([
    { type: "VP8X", payload: Buffer.from([0x02, 0, 0, 0, 0xaf, 0x04, 0, 0x1f, 0x03, 0]) },
  ]);
}

describe("cli action modules: md pdf-template codex command state", () => {
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

  test("preserves explicit --input alias spelling for replay and display", async () => {
    await withTempFixtureDir("md-pdf-template-codex-input-alias-display", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const aliasPath = join(fixtureDir, "report-alias.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      await symlink(inputPath, aliasPath);

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(aliasPath),
        positionalInput: toRepoRelativePath(inputPath),
      });

      expect(state.inputPath).toBe(aliasPath);
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

  test("rejects animated cover images during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-animated-cover", async (fixtureDir) => {
      const animatedPngPath = join(fixtureDir, "animated.png");
      const animatedWebpPath = join(fixtureDir, "animated.webp");
      await writeFile(animatedPngPath, minimalAnimatedPng(1200, 800));
      await writeFile(animatedWebpPath, minimalAnimatedWebp());

      const { runtime } = createActionTestRuntime();
      for (const coverImagePath of [animatedPngPath, animatedWebpPath]) {
        await expectCliError(
          () =>
            normalizeMdPdfTemplateCodexCommandState(runtime, {
              coverImage: toRepoRelativePath(coverImagePath),
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "Cover image must be a local still PNG, JPEG, or WebP file.",
          },
        );
      }
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

  test("rejects symlinked cover images during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-symlink-cover", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "cover.png");
      const coverAliasPath = join(fixtureDir, "cover-alias.png");
      await writeFile(coverImagePath, "not really an image yet\n", "utf8");
      await symlink(coverImagePath, coverAliasPath);

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            coverImage: toRepoRelativePath(coverAliasPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Cover image path must not be a symlink",
        },
      );
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
});
