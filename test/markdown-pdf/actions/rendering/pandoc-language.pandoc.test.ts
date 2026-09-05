import { registerFixtureOutput } from "../../../../scripts/testing/fixture-exports.ts";
import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { withPandocFixtureDir } from "../../pandoc-support";

describe("markdown PDF recipe generation: Pandoc language-attribute fixture", () => {
  test("preserves Pandoc span and Div lang attributes in rendered HTML", async () => {
    await withPandocFixtureDir(
      "md-to-pdf-pandoc-language-attributes",
      async (fixtureDir, runPandoc) => {
        const inputPath = join(fixtureDir, "mixed-langs.md");
        const outputPath = join(fixtureDir, "mixed-langs.html");
        registerFixtureOutput(fixtureDir, {
          source: outputPath,
          name: "mixed-langs.html",
          kind: "generated",
          required: true,
        });
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
        const result = await runPandoc(args);
        expect(result.exitCode).toBe(0);
        expect(args).toContain("markdown");

        const html = await readFile(outputPath, "utf8");
        expect(html).toMatch(/<span\s+lang="ja">日本語<\/span>/);
        expect(html).toMatch(/<span\s+lang="zh-Hant">繁體中文<\/span>/);
        expect(html).toMatch(/<div\s+lang="zh-Hant">\s*<p>這是一個繁體中文區塊。<\/p>\s*<\/div>/);
      },
    );
  }, 20_000);
});
