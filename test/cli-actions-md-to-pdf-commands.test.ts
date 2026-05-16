import { describe, expect, test } from "bun:test";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

async function createFakeMarkdownPdfDependencies(binDir: string, html: string): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const escapedHtml = html.replaceAll("\\", "\\\\").replaceAll("'", "'\\''");
  const pandocPath = join(binDir, "pandoc");
  const weasyprintPath = join(binDir, "weasyprint");

  await writeFile(
    pandocPath,
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then echo "pandoc 3.1"; exit 0; fi',
      'out=""',
      'while [ "$#" -gt 0 ]; do',
      '  if [ "$1" = "--output" ]; then shift; out="$1"; fi',
      "  shift",
      "done",
      `printf '%s' '${escapedHtml}' > "$out"`,
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    weasyprintPath,
    [
      "#!/bin/sh",
      'if [ "$1" = "--info" ]; then echo "WeasyPrint 68.0"; exit 0; fi',
      'out=""',
      'for arg in "$@"; do out="$arg"; done',
      'printf "%s\\n" "%PDF-1.7" > "$out"',
      "",
    ].join("\n"),
    "utf8",
  );
  await chmod(pandocPath, 0o755);
  await chmod(weasyprintPath, 0o755);
}

describe("cli command: md to-pdf", () => {
  test("lists code highlight flags in help", () => {
    const result = runCli(["md", "to-pdf", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--code-highlight");
    expect(result.stdout).toContain("--no-code-highlight");
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

describe("cli command: md pdf-template init", () => {
  test("writes a template recipe from the command layer", async () => {
    await withTempFixtureDir("md-pdf-template-cli", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const result = runCli([
        "md",
        "pdf-template",
        "init",
        "--output",
        toRepoRelativePath(outputDir),
        "--preset",
        "report",
        "--toc",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Wrote Markdown PDF template:");
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toContain("break-after: page");
    });
  });

  test("rejects invalid margin at the command layer", async () => {
    await withTempFixtureDir("md-pdf-template-cli", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const result = runCli([
        "md",
        "pdf-template",
        "init",
        "--output",
        toRepoRelativePath(outputDir),
        "--margin",
        "1rem",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--margin must be a CSS length");
    });
  });
});

describe("cli command: md pdf-profile init", () => {
  test("writes a profile file from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-cli", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      const result = runCli([
        "md",
        "pdf-profile",
        "init",
        "--output",
        toRepoRelativePath(outputPath),
        "--preset",
        "report",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Wrote Markdown PDF profile:");
      expect(await readFile(outputPath, "utf8")).toContain("pageNumbers:");
    });
  });
});
