import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { createTemplateCodexStub, minimalPng, pathExists } from "./fixtures";

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
      expect(result.stdout).toContain(`--profile '${toRepoRelativePath(baseProfilePath)}'`);
      expect(result.stdout).not.toContain("--template");
      expect(result.stdout).not.toContain("--css");
      expect(result.stderr).toContain("Wrote Markdown PDF template bundle:");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifactType: string;
        decision: { mode: string };
        files: Array<{ bundlePath: string }>;
        followUpRenderCommand: string;
      };
      expect(report.artifactType).toBe("markdown-pdf-codex-template-report");
      expect(report.decision.mode).toBe("deterministic");
      expect(report.files.map((file) => file.bundlePath).filter(Boolean)).toEqual([
        "template.html",
        "style.css",
      ]);
      expect(report.followUpRenderCommand).toContain(
        `--profile '${toRepoRelativePath(baseProfilePath)}'`,
      );
      expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
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
