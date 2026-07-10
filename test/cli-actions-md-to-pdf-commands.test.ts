import { describe, expect, test } from "bun:test";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function minimalPng(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

async function createCodexJsonlStub(input: {
  fixtureDir: string;
  filename: string;
  response: string;
}): Promise<string> {
  const stubPath = join(input.fixtureDir, input.filename);
  await writeFile(
    stubPath,
    `#!/usr/bin/env node
await new Promise((resolve, reject) => {
  process.stdin.resume();
  process.stdin.on("end", resolve);
  process.stdin.on("error", reject);
});
const response = ${JSON.stringify(input.response)};
process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-thread" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.started" }) + "\\n");
process.stdout.write(JSON.stringify({
  type: "item.completed",
  item: { id: "msg-1", type: "agent_message", text: response },
}) + "\\n");
process.stdout.write(JSON.stringify({
  type: "turn.completed",
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
}) + "\\n");
`,
    "utf8",
  );
  await chmod(stubPath, 0o755);
  return stubPath;
}

async function createTemplateCodexStub(fixtureDir: string): Promise<string> {
  return await createCodexJsonlStub({
    fixtureDir,
    filename: "template-codex-stub.mjs",
    response: JSON.stringify({
      decision_mode: "no-usable-template",
      template_family: "none",
      recipe_preset: "none",
      slots: {
        recipe_preset: { preset: "article", source: "renderer-default" },
        cover: {
          enabled: false,
          byline: "none",
          composition: "media-first-caption",
          image_fit: "",
          image_anchor: "center",
          media_align: "center",
          media_scale: "balanced",
          text_align: "center",
          style: "none",
          orientation_bucket: "unknown",
          fit_pressure: "unknown",
        },
        tables: { density: "standard", repeat_header: true, width: "content" },
        code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
        spacing: { density: "standard" },
        typography: { scale: "standard" },
        colors: { palette: "neutral" },
      },
      css_blocks: [],
      font_decisions: [],
      managed_assets: [],
      warnings: ["Unsupported template direction."],
      unsupported_directions: ["Unsupported template direction."],
      fallback_reason: "Unsupported template direction.",
    }),
  });
}

async function createProfileCodexStub(fixtureDir: string): Promise<string> {
  return await createCodexJsonlStub({
    fixtureDir,
    filename: "profile-codex-stub.mjs",
    response: JSON.stringify({
      decision_mode: "no-usable-profile",
      selected_candidate_id: "none",
      accepted_patches: [],
      accepted_font_patches: [],
      reasoning: "The requested profile direction is unsupported.",
      warnings: ["Unsupported profile direction."],
      fallback_reason: "Unsupported profile direction.",
      unmatched_directions: ["unsupported profile direction"],
    }),
  });
}

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
  test("lists bundle and code highlight flags in help", () => {
    const result = runCli(["md", "to-pdf", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--bundle <directory>");
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
    expect(result.stdout).not.toContain("--preset <value>");
    expect(result.stdout).not.toContain("--page-size <value>");
    expect(result.stdout).not.toContain("--orientation <value>");
    expect(result.stdout).not.toContain("--margin <length>");
    expect(result.stdout).not.toContain("--margin-x <length>");
    expect(result.stdout).not.toContain("--margin-y <length>");
    expect(result.stdout).not.toContain("--margin-top <length>");
    expect(result.stdout).not.toContain("--margin-right <length>");
    expect(result.stdout).not.toContain("--margin-bottom <length>");
    expect(result.stdout).not.toContain("--margin-left <length>");
    expect(result.stdout).not.toContain("--toc");
    expect(result.stdout).not.toContain("--toc-depth <n>");
    expect(result.stdout).not.toContain("--toc-page-break <value>");
    expect(result.stdout).toContain("--dry-run");
    expect(result.stderr).toBe("");
  });

  test("rejects removed recipe flags from the Codex template command surface", () => {
    for (const flag of ["--preset", "--margin", "--toc"] as const) {
      const result = runCli(["md", "pdf-template", "codex", flag, "report"]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`unknown option '${flag}'`);
    }
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

  test("writes a validated template bundle after deterministic synthesis", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cli-write-bundle", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "report-profile.yml");
      const outputPath = join(fixtureDir, "pdf-template");
      const reportPath = join(fixtureDir, "template-report.json");
      const profileResult = runCli([
        "md",
        "pdf-profile",
        "init",
        "--output",
        toRepoRelativePath(baseProfilePath),
        "--preset",
        "report",
      ]);
      expect(profileResult.exitCode).toBe(0);

      const result = runCli([
        "md",
        "pdf-template",
        "codex",
        "--base-profile",
        toRepoRelativePath(baseProfilePath),
        "--output",
        toRepoRelativePath(outputPath),
        "--codex-report-output",
        toRepoRelativePath(reportPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Signal mode: base-profile-only");
      expect(result.stdout).toContain("Decision mode: deterministic");
      expect(result.stdout).toContain("Template family: document-layered");
      expect(result.stdout).toContain("Recipe preset: article (renderer-default)");
      expect(result.stdout).toContain("Template bundle: md-pdf-template-");
      expect(result.stdout).toContain(`Output directory: ${toRepoRelativePath(outputPath)}`);
      expect(result.stdout).toContain("Template HTML: template.html");
      expect(result.stdout).toContain("Stylesheet: style.css");
      expect(result.stdout).toContain("Managed assets: 0");
      expect(result.stdout).toContain(`Codex report: ${toRepoRelativePath(reportPath)}`);
      expect(result.stdout).toContain("Follow-up render: cdx-chores md to-pdf");
      expect(result.stdout).toContain(`--bundle '${toRepoRelativePath(outputPath)}'`);
      expect(result.stdout).not.toContain("--template");
      expect(result.stdout).not.toContain("--css");
      expect(result.stderr).toContain("Wrote Markdown PDF template bundle:");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifactType: string;
        decision: { mode: string };
        files: Array<{ bundlePath: string }>;
      };
      expect(report.artifactType).toBe("markdown-pdf-codex-template-report");
      expect(report.decision.mode).toBe("deterministic");
      expect(report.files.map((file) => file.bundlePath).filter(Boolean)).toEqual([
        "template.html",
        "style.css",
      ]);
    });
  });

  test("routes base profile, cover image, and font hints through Codex-assisted command wiring", async () => {
    await withTempFixtureDir("md-pdf-template-codex-cli-signal-options", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "profile.yml");
      const coverImagePath = join(fixtureDir, "cover.png");
      const outputPath = join(fixtureDir, "pdf-template");
      await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");
      await writeFile(coverImagePath, minimalPng(1600, 900));
      const codexStubPath = await createTemplateCodexStub(fixtureDir);

      const result = runCli(
        [
          "md",
          "pdf-template",
          "codex",
          "--base-profile",
          toRepoRelativePath(baseProfilePath),
          "--cover-image",
          toRepoRelativePath(coverImagePath),
          "--font-hint",
          "Inter",
          "--font-hint",
          "Noto Sans",
          "--output",
          toRepoRelativePath(outputPath),
        ],
        undefined,
        {
          CDX_CHORES_CODEX_PATH: codexStubPath,
          CODEX_API_KEY: "",
          OPENAI_API_KEY: "",
        },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("Signal mode: codex-assisted");
      expect(result.stdout).toContain("Decision mode: no-usable-template");
      expect(result.stdout).toContain("Fallback reason: Unsupported template direction.");
      expect(result.stdout).not.toContain("Template family:");
      expect(result.stdout).not.toContain("Managed assets:");
      expect(result.stderr).toContain("Requesting Codex Markdown PDF template recommendation");
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "assets", "cover.png"))).toBe(false);
    });
  });
});

describe("cli command: md pdf-project codex", () => {
  test("documents the project Codex helper options", () => {
    const result = runCli(["md", "pdf-project", "codex", "--help"]);
    const normalizedStdout = result.stdout.replace(/\s+/g, " ");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: cdx-chores md pdf-project codex [options] [input]");
    expect(normalizedStdout).toContain(
      "Draft a coordinated Markdown PDF profile and template project bundle",
    );
    expect(result.stdout).toContain("input");
    expect(normalizedStdout).toContain("Markdown sample for shared project signals");
    expect(result.stdout).toContain("-i, --input <path>");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--font-hint <text>");
    expect(result.stdout).toContain("--base-profile <path>");
    expect(result.stdout).toContain("--cover-image <path>");
    expect(result.stdout).toContain("-o, --output <directory>");
    expect(result.stdout).toContain("--dry-run");
    expect(result.stdout).toContain("--keep-codex-report");
    expect(result.stdout).toContain("--codex-report-output <path>");
    expect(result.stdout).toContain("--overwrite");
    expect(result.stdout).not.toContain("--preset <value>");
    expect(result.stdout).not.toContain("--page-size <value>");
    expect(result.stdout).not.toContain("--orientation <value>");
    expect(result.stdout).not.toContain("--margin <length>");
    expect(result.stdout).not.toContain("--margin-x <length>");
    expect(result.stdout).not.toContain("--margin-y <length>");
    expect(result.stdout).not.toContain("--margin-top <length>");
    expect(result.stdout).not.toContain("--margin-right <length>");
    expect(result.stdout).not.toContain("--margin-bottom <length>");
    expect(result.stdout).not.toContain("--margin-left <length>");
    expect(result.stdout).not.toContain("--toc");
    expect(result.stdout).not.toContain("--toc-depth <n>");
    expect(result.stdout).not.toContain("--toc-page-break <value>");
    expect(result.stderr).toBe("");
  });

  test("rejects recipe flags from the project Codex command surface", () => {
    for (const flag of ["--preset", "--margin", "--toc"] as const) {
      const result = runCli(["md", "pdf-project", "codex", flag, "report"]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`unknown option '${flag}'`);
    }
  });

  test("rejects conflicting positional and explicit project inputs from the command layer", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-input-conflict", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "one.md");
      const secondInputPath = join(fixtureDir, "two.md");
      await writeFile(firstInputPath, "# One\n", "utf8");
      await writeFile(secondInputPath, "# Two\n", "utf8");

      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        toRepoRelativePath(firstInputPath),
        "--input",
        toRepoRelativePath(secondInputPath),
        "--output",
        toRepoRelativePath(join(fixtureDir, "pdf-project")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Positional input and --input");
    });
  });

  test("rejects invalid project report paths before later orchestration work", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-report-path", async (fixtureDir) => {
      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        "--codex-report-output",
        toRepoRelativePath(join(fixtureDir, "project-report.txt")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("project Codex report path must end with .json");
    });
  });

  test("writes deterministic project bundles from the command layer", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-write", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "pdf-project");
      await writeFile(
        baseProfilePath,
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
        "utf8",
      );

      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        "--base-profile",
        toRepoRelativePath(baseProfilePath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Project signal mode: deterministic");
      expect(result.stdout).toContain("Final decision mode: deterministic");
      expect(result.stdout).toContain("Profile: profile.yml");
      expect(result.stdout).toContain("Template HTML: template.html");
      expect(result.stdout).toContain("Stylesheet: style.css");
      expect(result.stderr).toContain("Wrote Markdown PDF project bundle:");
      expect(await readFile(join(outputPath, "profile.yml"), "utf8")).toContain("md-pdf-profile-");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
    });
  });

  test("writes dry-run project reports from the command layer", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-dry-run-report", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "pdf-project");
      await writeFile(
        baseProfilePath,
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
        "utf8",
      );

      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        "--base-profile",
        toRepoRelativePath(baseProfilePath),
        "--output",
        toRepoRelativePath(outputPath),
        "--dry-run",
        "--keep-codex-report",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Project signal mode: deterministic");
      expect(result.stdout).toContain("Final decision mode: deterministic");
      expect(result.stdout).toContain("Dry run only. No project bundle files were written.");
      expect(result.stdout).toContain("Codex report:");
      expect(result.stdout).toContain(
        toRepoRelativePath(join(outputPath, "project.codex-report.json")),
      );
      expect(result.stdout).toContain("Follow-up render:");
      expect(result.stdout).toContain(`'--bundle' '${toRepoRelativePath(outputPath)}'`);
      expect(result.stdout).toContain("<input.md>");
      expect(result.stdout).toContain("<output.pdf>");
      expect(result.stderr).toBe("");
      expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "style.css"))).toBe(false);

      const reportText = await readFile(join(outputPath, "project.codex-report.json"), "utf8");
      const report = JSON.parse(reportText) as {
        advisoryOnly: boolean;
        artifactType: string;
        files: Array<{ bundlePath?: string; role: string }>;
        followUpRenderCommand: { args: string[]; display: string };
        project: { decisionMode: string; signalMode: string };
      };
      expect(report).toMatchObject({
        advisoryOnly: true,
        artifactType: "markdown-pdf-codex-project-report",
        project: {
          decisionMode: "deterministic",
          signalMode: "deterministic",
        },
      });
      expect(report.files.map((file) => file.role)).toEqual([
        "profile",
        "template-html",
        "style-css",
        "project-report",
      ]);
      expect(report.files.find((file) => file.role === "project-report")).toMatchObject({
        bundlePath: "project.codex-report.json",
      });
      expect(report.followUpRenderCommand.display).toContain("<input.md>");
      expect(report.followUpRenderCommand.display).toContain("<output.pdf>");
      expect(report.followUpRenderCommand.args).toContain("<input.md>");
      expect(report.followUpRenderCommand.args).toContain("<output.pdf>");
    });
  });

  test("writes dry-run reports before no-usable project failures from the command layer", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-cli-dry-run-no-usable-report",
      async (fixtureDir) => {
        const baseProfilePath = join(fixtureDir, "base.yml");
        const reportPath = join(fixtureDir, "project-report.json");
        const outputPath = join(fixtureDir, "pdf-project");
        await writeFile(
          baseProfilePath,
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "page:",
            "  size: Letter",
            "cover:",
            "  enabled: true",
            "  style: report",
            "  fields:",
            "    title: Project Cover",
            "",
          ].join("\n"),
          "utf8",
        );

        const result = runCli([
          "md",
          "pdf-project",
          "codex",
          "--base-profile",
          toRepoRelativePath(baseProfilePath),
          "--output",
          toRepoRelativePath(outputPath),
          "--dry-run",
          "--codex-report-output",
          toRepoRelativePath(reportPath),
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("Project signal mode: deterministic");
        expect(result.stdout).toContain("Final decision mode: no-usable-project");
        expect(result.stdout).toContain("Dry run only. No project bundle files were written.");
        expect(result.stdout).toContain("Codex report:");
        expect(result.stdout).toContain(toRepoRelativePath(reportPath));
        expect(result.stdout).not.toContain(fixtureDir);
        expect(result.stderr).toContain("profile-owned text cover");
        expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
        expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
        expect(await pathExists(join(outputPath, "style.css"))).toBe(false);

        expect(await pathExists(join(outputPath, "project.codex-report.json"))).toBe(false);

        const reportText = await readFile(reportPath, "utf8");
        const report = JSON.parse(reportText) as {
          files: Array<{ path?: string; role: string }>;
          followUpRenderCommand?: unknown;
          input: { baseProfile: { basename: string } };
          project: { decisionMode: string; fallbackReason?: string };
        };
        expect(report.project).toMatchObject({
          decisionMode: "no-usable-project",
          fallbackReason:
            "Project template would defeat the profile-owned text cover; disable the profile cover or provide a compatible cover template.",
        });
        expect(report.input.baseProfile.basename).toBe("base.yml");
        expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
        expect(report.files[0]?.path).toBe(toRepoRelativePath(reportPath));
        expect(report.files[0]?.path).not.toContain(fixtureDir);
        expect(report.followUpRenderCommand).toBeUndefined();
      },
    );
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

  test("writes no-usable failure reports from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-no-usable-report", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "profile.codex-report.json");
      const codexStubPath = await createProfileCodexStub(fixtureDir);

      const result = runCli(
        [
          "md",
          "pdf-profile",
          "codex",
          "--intent",
          "unsupported profile direction",
          "--output",
          toRepoRelativePath(outputPath),
          "--codex-report-output",
          toRepoRelativePath(reportPath),
        ],
        undefined,
        {
          CDX_CHORES_CODEX_PATH: codexStubPath,
          CODEX_API_KEY: "",
          OPENAI_API_KEY: "",
        },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Requesting Codex Markdown PDF profile recommendation");
      expect(result.stderr).toContain("Wrote Codex report:");
      expect(result.stderr).toContain("Codex did not find a usable Markdown PDF profile.");
      expect(await pathExists(outputPath)).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifact: { type: string };
        result: {
          failure?: { kind: string; message: string };
          status: string;
          unmatchedDirections: string[];
        };
      };
      expect(report.artifact.type).toBe("markdown-pdf-codex-profile-report");
      expect(report.result).toMatchObject({
        failure: {
          kind: "no-usable-profile",
          message: "Codex did not find a usable Markdown PDF profile.",
        },
        status: "failed",
        unmatchedDirections: [],
      });
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
