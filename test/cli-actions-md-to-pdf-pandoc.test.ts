import { describe, expect } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pandocTest } from "./markdown-pdf/actions/render-support";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("markdown PDF recipe generation: Pandoc language-attribute fixture", () => {
  pandocTest("preserves Pandoc span and Div lang attributes in rendered HTML", async () => {
    await withTempFixtureDir("md-to-pdf-pandoc-language-attributes", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "mixed-langs.md");
      const outputPath = join(fixtureDir, "mixed-langs.html");
      await writeFile(
        inputPath,
        [
          "English [日本語]{lang=ja} and [繁體中文]{lang=zh-Hant}.",
          "",
          "::: {lang=zh-Hant}",
          "這是一個繁體中文區塊。",
          ":::",
          "",
        ].join("\n"),
        "utf8",
      );

      const args = [inputPath, "--from", "markdown", "--to", "html", "--output", outputPath];
      const result = Bun.spawnSync({
        cmd: ["pandoc", ...args],
        cwd: fixtureDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(result.exitCode).toBe(0);
      expect(args).toContain("markdown");

      const html = await readFile(outputPath, "utf8");
      expect(html).toMatch(/<span\s+lang="ja">日本語<\/span>/);
      expect(html).toMatch(/<span\s+lang="zh-Hant">繁體中文<\/span>/);
      expect(html).toMatch(/<div\s+lang="zh-Hant">\s*<p>這是一個繁體中文區塊。<\/p>\s*<\/div>/);
    });
  });
});
