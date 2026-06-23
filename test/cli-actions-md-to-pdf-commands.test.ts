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

describe("cli command: md pdf-template codex", () => {
  test("documents the direct Codex template helper options", () => {
    const result = runCli(["md", "pdf-template", "codex", "--help"]);
    const normalizedStdout = result.stdout.replace(/\s+/g, " ");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: cdx-chores md pdf-template codex [options] [input]");
    expect(normalizedStdout).toContain(
      "Draft a reviewable Markdown PDF template bundle from bounded signals",
    );
    expect(result.stdout).toContain("input");
    expect(normalizedStdout).toContain("Markdown sample for document-informed template signals");
    expect(result.stdout).toContain("-i, --input <path>");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--font-hint <text>");
    expect(result.stdout).toContain("--base-profile <path>");
    expect(result.stdout).toContain("--cover-image <path>");
    expect(result.stdout).toContain("-o, --output <path>");
    expect(result.stdout).toContain("--keep-codex-report");
    expect(result.stdout).toContain("--codex-report-output <path>");
    expect(result.stdout).toContain("--overwrite");
    expect(result.stdout).toContain("--preset <value>");
    expect(result.stdout).toContain("--toc-depth <n>");
    expect(result.stderr).toBe("");
  });

  test("rejects conflicting positional and explicit Codex template inputs from the command layer", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cli-input-conflict", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "one.md");
      const secondInputPath = join(fixtureDir, "two.md");
      await writeFile(firstInputPath, "# One\n", "utf8");
      await writeFile(secondInputPath, "# Two\n", "utf8");

      const result = runCli([
        "md",
        "pdf-template",
        "codex",
        toRepoRelativePath(firstInputPath),
        "--input",
        toRepoRelativePath(secondInputPath),
        "--output",
        toRepoRelativePath(join(fixtureDir, "pdf-template")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Positional input and --input");
    });
  });

  test("rejects invalid report paths before later template work", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cli-report-path", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const result = runCli([
        "md",
        "pdf-template",
        "codex",
        "--input",
        toRepoRelativePath(inputPath),
        "--codex-report-output",
        toRepoRelativePath(join(fixtureDir, "report.txt")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("report path must end with .json");
    });
  });

  test("stops at the Phase 1 implementation boundary after normalization", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cli-phase1-boundary", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const result = runCli([
        "md",
        "pdf-template",
        "codex",
        "--input",
        toRepoRelativePath(inputPath),
        "--intent",
        "dense report",
        "--output",
        toRepoRelativePath(join(fixtureDir, "pdf-template")),
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("signal collection begins in Phase 2");
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

describe("cli command: md pdf-profile codex", () => {
  test("documents the direct Codex profile helper options", () => {
    const result = runCli(["md", "pdf-profile", "codex", "--help"]);
    const normalizedStdout = result.stdout.replace(/\s+/g, " ");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: cdx-chores md pdf-profile codex [options] [input]");
    expect(normalizedStdout).toContain(
      "Draft a reusable Markdown PDF profile from sample signals, hints, or fallback defaults",
    );
    expect(result.stdout).toContain("input");
    expect(normalizedStdout).toContain("Markdown sample for document-informed profile signals");
    expect(result.stdout).toContain("-i, --input <path>");
    expect(result.stdout).toContain("Same as the input argument; useful in scripts");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--font-hint <text>");
    expect(normalizedStdout).toContain(
      "Repeatable font preference hint for the same Codex request",
    );
    expect(result.stdout).toContain("--base-profile <path>");
    expect(result.stdout).toContain("--keep-codex-report");
    expect(result.stderr).toBe("");
  });

  test("allows no-signal deterministic profile creation from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-basic", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "profile.yml");

      const result = runCli([
        "md",
        "pdf-profile",
        "codex",
        "--output",
        toRepoRelativePath(outputPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Signal mode: basic-default");
      expect(result.stdout).toContain("Decision: deterministic");
      expect(result.stderr).toContain("Wrote Markdown PDF profile:");
      expect(await readFile(outputPath, "utf8")).toContain("source: deterministic");
    });
  });

  test("treats blank-only font hints as no signal from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-blank-font-hint", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "profile.yml");

      const result = runCli([
        "md",
        "pdf-profile",
        "codex",
        "--font-hint",
        "   ",
        "--output",
        toRepoRelativePath(outputPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Signal mode: basic-default");
      expect(result.stdout).toContain("Decision: deterministic");
      expect(result.stderr).toContain("Wrote Markdown PDF profile:");
      expect(await readFile(outputPath, "utf8")).toContain("source: deterministic");
    });
  });

  test("rejects conflicting positional and explicit Codex profile inputs from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-input-conflict", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "one.md");
      const secondInputPath = join(fixtureDir, "two.md");
      await writeFile(firstInputPath, "# One\n", "utf8");
      await writeFile(secondInputPath, "# Two\n", "utf8");

      const result = runCli([
        "md",
        "pdf-profile",
        "codex",
        toRepoRelativePath(firstInputPath),
        "--input",
        toRepoRelativePath(secondInputPath),
        "--output",
        toRepoRelativePath(join(fixtureDir, "profile.yml")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Positional input and --input");
    });
  });
});
