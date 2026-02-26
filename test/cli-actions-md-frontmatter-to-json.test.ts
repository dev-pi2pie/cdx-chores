import { describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdFrontmatterToJson } from "../src/cli/actions";
import { CliError } from "../src/cli/errors";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  runCli,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";

async function expectCliError(
  run: () => Promise<unknown>,
  expected: { code: string; exitCode?: number; messageIncludes?: string },
): Promise<CliError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    const cliError = error as CliError;
    expect(cliError.code).toBe(expected.code);
    if (expected.exitCode !== undefined) {
      expect(cliError.exitCode).toBe(expected.exitCode);
    }
    if (expected.messageIncludes) {
      expect(cliError.message).toContain(expected.messageIncludes);
    }
    return cliError;
  }

  throw new Error("Expected CliError but action resolved successfully");
}

describe("cli action modules: md frontmatter-to-json", () => {
  test("emits wrapper JSON to stdout by default", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-action");
    try {
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

      const { runtime, stdout, stderr } = createCapturedRuntime();
      await actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) });

      expect(stderr.text).toBe("");
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
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("supports data-only and pretty output", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-action");
    try {
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

      const { runtime, stdout, stderr } = createCapturedRuntime();
      await actionMdFrontmatterToJson(runtime, {
        input: toRepoRelativePath(inputPath),
        dataOnly: true,
        pretty: true,
      });

      expect(stderr.text).toBe("");
      expect(stdout.text.startsWith("{\n  ")).toBe(true);
      const payload = JSON.parse(stdout.text) as Record<string, unknown>;
      expect(payload).toMatchObject({
        title: "Release Notes",
        draft: false,
        version: 2,
      });
      expect("frontmatterType" in payload).toBe(false);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("parses TOML frontmatter and reports frontmatterType=toml", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-action");
    try {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        [
          "+++",
          'title = "Release Notes"',
          'category = "docs"',
          "+++",
          "",
          "# Changelog",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runtime, stdout, stderr } = createCapturedRuntime();
      await actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) });

      expect(stderr.text).toBe("");
      const payload = JSON.parse(stdout.text) as {
        frontmatterType: string;
        data: Record<string, unknown>;
      };
      expect(payload.frontmatterType).toBe("toml");
      expect(payload.data).toMatchObject({
        title: "Release Notes",
        category: "docs",
      });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("writes derived .frontmatter.json file when output is file mode with default path", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-action");
    try {
      const inputPath = join(fixtureDir, "notes.md");
      await writeFile(
        inputPath,
        [';;;', '{"title":"Release Notes","draft":false}', ';;;', "", "# Changelog", ""].join("\n"),
        "utf8",
      );

      const { runtime, stdout, stderr } = createCapturedRuntime();
      await actionMdFrontmatterToJson(runtime, {
        input: toRepoRelativePath(inputPath),
        toStdout: false,
      });

      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Wrote JSON:");

      const outputPath = join(fixtureDir, "notes.frontmatter.json");
      const written = JSON.parse(await readFile(outputPath, "utf8")) as {
        frontmatterType: string;
        data: Record<string, unknown>;
      };
      expect(written.frontmatterType).toBe("json");
      expect(written.data).toMatchObject({ title: "Release Notes", draft: false });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rejects missing frontmatter", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-action");
    try {
      const inputPath = join(fixtureDir, "no-frontmatter.md");
      await writeFile(inputPath, "# Plain Markdown\n\nNo metadata.\n", "utf8");

      const { runtime, stdout, stderr } = createCapturedRuntime();
      await expectCliError(
        () => actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) }),
        {
          code: "FRONTMATTER_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "No frontmatter found",
        },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid frontmatter that fails parsing", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-action");
    try {
      const inputPath = join(fixtureDir, "invalid-frontmatter.md");
      await writeFile(inputPath, ["---", "title: [oops", "---", ""].join("\n"), "utf8");

      const { runtime, stdout, stderr } = createCapturedRuntime();
      await expectCliError(
        () => actionMdFrontmatterToJson(runtime, { input: toRepoRelativePath(inputPath) }),
        {
          code: "INVALID_FRONTMATTER",
          exitCode: 2,
          messageIncludes: "Failed to parse frontmatter as an object",
        },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});

describe("cli command: md frontmatter-to-json", () => {
  test("prints wrapper JSON by default", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-cli");
    try {
      const inputPath = join(fixtureDir, "sample.md");
      await writeFile(
        inputPath,
        ["---", 'title: "Release Notes"', "draft: false", "---", "", "# Changelog", ""].join("\n"),
        "utf8",
      );

      const result = runCli(["md", "frontmatter-to-json", "-i", toRepoRelativePath(inputPath)]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");

      const payload = JSON.parse(result.stdout) as { frontmatterType: string; data: Record<string, unknown> };
      expect(payload.frontmatterType).toBe("yaml");
      expect(payload.data).toMatchObject({ title: "Release Notes", draft: false });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("supports --data-only and --pretty flags", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-cli");
    try {
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
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("returns an error for missing frontmatter", async () => {
    const fixtureDir = await createTempFixtureDir("md-frontmatter-cli");
    try {
      const inputPath = join(fixtureDir, "plain.md");
      await writeFile(inputPath, "# Plain Markdown\n", "utf8");

      const result = runCli(["md", "frontmatter-to-json", "-i", toRepoRelativePath(inputPath)]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("No frontmatter found in Markdown file:");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
