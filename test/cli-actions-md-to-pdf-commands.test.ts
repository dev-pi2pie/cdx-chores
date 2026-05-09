import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli command: md to-pdf", () => {
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
