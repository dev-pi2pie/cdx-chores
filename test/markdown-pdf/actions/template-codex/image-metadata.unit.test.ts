import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readTemplateCodexCoverImageMetadata } from "../../../../src/cli/markdown-pdf/template-codex/image-metadata";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import {
  minimalWebpVp8Lossy640By480,
  minimalWebpVp8lLossless321By654,
  minimalWebpVp8x1200By800,
  minimalWebpVp8x900By300Payload,
  minimalWebpWithChunks,
} from "../template-codex-fixtures";

describe("cli action modules: md pdf-template codex image metadata", () => {
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
});
