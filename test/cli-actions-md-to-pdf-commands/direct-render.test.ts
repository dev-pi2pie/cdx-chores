import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { createFakeMarkdownPdfDependencies } from "./fixtures";

describe("cli command: md to-pdf", () => {
  test("lists bundle, code highlight, and page-number flags in help", () => {
    const result = runCli(["md", "to-pdf", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--bundle <directory>");
    expect(result.stdout).toContain("--code-highlight");
    expect(result.stdout).toContain("--no-code-highlight");
    expect(result.stdout).toContain(
      [
        "--page-numbers            Enable page numbers for this render using",
        "                            Profile/default details",
      ].join("\n"),
    );
    expect(result.stdout).toContain(
      "--no-page-numbers         Disable page numbers for this render",
    );
    expect(result.stderr).toBe("");
  });

  test("parses --code-highlight before action validation", async () => {
    await withTempFixtureDir("md-to-pdf-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "code:\n  lineNumbers: true\n", "utf8");

      const result = runCli(
        [
          "md",
          "to-pdf",
          "--input",
          toRepoRelativePath(inputPath),
          "--profile",
          toRepoRelativePath(profilePath),
          "--code-highlight",
        ],
        undefined,
        { PATH: "" },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Missing required dependency: pandoc");
      expect(result.stderr).not.toContain("profile.code.lineNumbers requires code.highlight");
    });
  });

  test("parses --no-code-highlight before action validation", async () => {
    await withTempFixtureDir("md-to-pdf-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "code:\n  lineNumbers: true\n", "utf8");

      const result = runCli(
        [
          "md",
          "to-pdf",
          "--input",
          toRepoRelativePath(inputPath),
          "--profile",
          toRepoRelativePath(profilePath),
          "--no-code-highlight",
        ],
        undefined,
        { PATH: "" },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Missing required dependency: pandoc");
      expect(result.stderr).not.toContain("profile.code.lineNumbers requires code.highlight");
    });
  });

  test("runs successfully with --code-highlight from the command layer", async () => {
    await withTempFixtureDir("md-to-pdf-cli-highlight", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.render.html");
      const binDir = join(fixtureDir, "bin");
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");
      await createFakeMarkdownPdfDependencies(
        binDir,
        '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>',
      );

      const result = runCli(
        [
          "md",
          "to-pdf",
          "--input",
          toRepoRelativePath(inputPath),
          "--output",
          toRepoRelativePath(outputPath),
          "--html-output",
          toRepoRelativePath(htmlOutput),
          "--code-highlight",
        ],
        undefined,
        { PATH: binDir },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Wrote PDF:");
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(await readFile(htmlOutput, "utf8")).toContain("cdx-code--highlighted");
    });
  });

  test("runs successfully with --no-code-highlight from the command layer", async () => {
    await withTempFixtureDir("md-to-pdf-cli-highlight", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.render.html");
      const binDir = join(fixtureDir, "bin");
      const html =
        '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>';
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");
      await writeFile(profilePath, "code:\n  highlight: true\n", "utf8");
      await createFakeMarkdownPdfDependencies(binDir, html);

      const result = runCli(
        [
          "md",
          "to-pdf",
          "--input",
          toRepoRelativePath(inputPath),
          "--profile",
          toRepoRelativePath(profilePath),
          "--output",
          toRepoRelativePath(outputPath),
          "--html-output",
          toRepoRelativePath(htmlOutput),
          "--no-code-highlight",
        ],
        undefined,
        { PATH: binDir },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(await readFile(htmlOutput, "utf8")).toBe(html);
    });
  });

  test("forwards --profile to the action layer", async () => {
    await withTempFixtureDir("md-to-pdf-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "unknown: true\n", "utf8");

      const result = runCli([
        "md",
        "to-pdf",
        "--input",
        toRepoRelativePath(inputPath),
        "--profile",
        toRepoRelativePath(profilePath),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Unknown Markdown PDF profile key: profile.unknown");
    });
  });
});
