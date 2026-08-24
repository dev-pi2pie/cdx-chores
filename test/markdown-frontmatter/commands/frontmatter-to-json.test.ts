import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("cli command: md frontmatter-to-json", () => {
  test("prints wrapper JSON by default", async () => {
    await withTempFixtureDir("md-frontmatter-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        ["---", 'title: "Release Notes"', "draft: false", "---", "", "# Changelog", ""].join("\n"),
        "utf8",
      );

      const result = runCli(["md", "frontmatter-to-json", "-i", toRepoRelativePath(inputPath)]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");

      const payload = JSON.parse(result.stdout) as {
        frontmatterType: string;
        data: Record<string, unknown>;
      };
      expect(payload.frontmatterType).toBe("yaml");
      expect(payload.data).toMatchObject({ title: "Release Notes", draft: false });
    });
  });

  test("supports --data-only and --pretty flags", async () => {
    await withTempFixtureDir("md-frontmatter-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        ["---", 'title: "Release Notes"', "version: 2", "---", "", "# Changelog", ""].join("\n"),
        "utf8",
      );

      const result = runCli([
        "md",
        "frontmatter-to-json",
        "-i",
        toRepoRelativePath(inputPath),
        "--data-only",
        "--pretty",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.startsWith("{\n  ")).toBe(true);

      const payload = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(payload).toMatchObject({ title: "Release Notes", version: 2 });
      expect("frontmatterType" in payload).toBe(false);
    });
  });

  test("returns an error for missing frontmatter", async () => {
    await withTempFixtureDir("md-frontmatter-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "plain.md");
      await writeFile(inputPath, "# Plain Markdown\n", "utf8");

      const result = runCli(["md", "frontmatter-to-json", "-i", toRepoRelativePath(inputPath)]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("No frontmatter found in Markdown file:");
    });
  });
});
