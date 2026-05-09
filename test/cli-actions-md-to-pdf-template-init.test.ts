import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateInit } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf template init", () => {
  test("writes default template files", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfTemplateInit(runtime, {
        output: toRepoRelativePath(outputDir),
        preset: "reader",
      });

      expect(await readFile(join(outputDir, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toContain("size: A4 portrait");
      expect(stdout.text).toContain("Wrote Markdown PDF template:");
      expectNoStderr();
    });
  });

  test("refuses a non-empty template directory without overwrite", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, "template.html"), "old", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () => actionMdPdfTemplateInit(runtime, { output: toRepoRelativePath(outputDir) }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Template output directory is not empty",
        },
      );

      expectNoOutput();
    });
  });

  test("overwrites existing recipe files with overwrite", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, "template.html"), "old", "utf8");
      await writeFile(join(outputDir, "style.css"), "old", "utf8");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfTemplateInit(runtime, {
        output: toRepoRelativePath(outputDir),
        overwrite: true,
      });

      expect(await readFile(join(outputDir, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toContain("@page");
      expectNoStderr();
    });
  });
});
