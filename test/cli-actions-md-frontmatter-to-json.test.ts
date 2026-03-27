import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdFrontmatterToJson } from "../src/cli/actions";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";

describe("cli action modules: md frontmatter-to-json", () => {
  test("emits wrapper JSON to stdout by default", async () => {
    await withTempFixtureDir("md-frontmatter-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        [
          "---",
          'title: "Release Notes"',
          "draft: false",
          "version: 2",
          "---",
          "",
          "# Changelog",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) });

      expectNoStderr();
      const payload = JSON.parse(stdout.text) as {
        frontmatterType: string;
        data: Record<string, unknown>;
      };
      expect(payload.frontmatterType).toBe("yaml");
      expect(payload.data).toMatchObject({
        title: "Release Notes",
        draft: false,
        version: 2,
      });
    });
  });

  test("supports data-only and pretty output", async () => {
    await withTempFixtureDir("md-frontmatter-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        [
          "---",
          'title: "Release Notes"',
          "draft: false",
          "version: 2",
          "---",
          "",
          "# Changelog",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionMdFrontmatterToJson(runtime, {
        input: toRepoRelativePath(inputPath),
        dataOnly: true,
        pretty: true,
      });

      expectNoStderr();
      expect(stdout.text.startsWith("{\n  ")).toBe(true);
      const payload = JSON.parse(stdout.text) as Record<string, unknown>;
      expect(payload).toMatchObject({
        title: "Release Notes",
        draft: false,
        version: 2,
      });
      expect("frontmatterType" in payload).toBe(false);
    });
  });

  test("parses TOML frontmatter and reports frontmatterType=toml", async () => {
    await withTempFixtureDir("md-frontmatter-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        ["+++", 'title = "Release Notes"', 'category = "docs"', "+++", "", "# Changelog", ""].join(
          "\n",
        ),
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) });

      expectNoStderr();
      const payload = JSON.parse(stdout.text) as {
        frontmatterType: string;
        data: Record<string, unknown>;
      };
      expect(payload.frontmatterType).toBe("toml");
      expect(payload.data).toMatchObject({
        title: "Release Notes",
        category: "docs",
      });
    });
  });

  test("writes derived .frontmatter.json file when output is file mode with default path", async () => {
    await withTempFixtureDir("md-frontmatter-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "notes.md");
      await writeFile(
        inputPath,
        [";;;", '{"title":"Release Notes","draft":false}', ";;;", "", "# Changelog", ""].join("\n"),
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionMdFrontmatterToJson(runtime, {
        input: toRepoRelativePath(inputPath),
        toStdout: false,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Wrote JSON:");

      const outputPath = join(fixtureDir, "notes.frontmatter.json");
      const written = JSON.parse(await readFile(outputPath, "utf8")) as {
        frontmatterType: string;
        data: Record<string, unknown>;
      };
      expect(written.frontmatterType).toBe("json");
      expect(written.data).toMatchObject({ title: "Release Notes", draft: false });
    });
  });

  test("rejects missing frontmatter", async () => {
    await withTempFixtureDir("md-frontmatter-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-frontmatter.md");
      await writeFile(inputPath, "# Plain Markdown\n\nNo metadata.\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () => actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) }),
        {
          code: "FRONTMATTER_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "No frontmatter found",
        },
      );

      expectNoOutput();
    });
  });

  test("rejects invalid frontmatter that fails parsing", async () => {
    await withTempFixtureDir("md-frontmatter-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "invalid-frontmatter.md");
      await writeFile(inputPath, ["---", "title: [oops", "---", ""].join("\n"), "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () => actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) }),
        {
          code: "INVALID_FRONTMATTER",
          exitCode: 2,
          messageIncludes: "Failed to parse frontmatter as an object",
        },
      );

      expectNoOutput();
    });
  });
});

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
