import { describe, expect } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pandocTest } from "./cli-actions-md-to-pdf.helpers";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("markdown PDF recipe generation: Pandoc language span fixture", () => {
  pandocTest("preserves Pandoc span lang attributes in rendered HTML", async () => {
    await withTempFixtureDir("md-to-pdf-pandoc-span", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "mixed-langs.md");
      const outputPath = join(fixtureDir, "mixed-langs.html");
      await writeFile(
        inputPath,
        "English [日本語]{lang=ja} and [繁體中文]{lang=zh-Hant}.\n",
        "utf8",
      );

      const result = Bun.spawnSync({
        cmd: ["pandoc", inputPath, "--from", "markdown", "--to", "html", "--output", outputPath],
        cwd: fixtureDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(result.exitCode).toBe(0);

      const html = await readFile(outputPath, "utf8");
      expect(html).toMatch(/<span\s+lang="ja">日本語<\/span>/);
      expect(html).toMatch(/<span\s+lang="zh-Hant">繁體中文<\/span>/);
    });
  });
});
