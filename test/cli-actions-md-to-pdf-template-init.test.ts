import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateInit } from "../src/cli/actions";
import {
  bindPreparedMarkdownPdfTemplateInitDestination,
  prepareMarkdownPdfTemplateInit,
  writePreparedMarkdownPdfTemplateInit,
} from "../src/cli/markdown-pdf/template/init-service";
import { normalizeMarkdownPdfOptions } from "../src/cli/markdown-pdf/validation";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf template init", () => {
  test("writes default template files with prepared-service parity", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      const options = {
        output: toRepoRelativePath(outputDir),
        preset: "reader",
      };
      const prepared = prepareMarkdownPdfTemplateInit(normalizeMarkdownPdfOptions(options));

      await actionMdPdfTemplateInit(runtime, options);

      expect(await readFile(join(outputDir, "template.html"), "utf8")).toBe(prepared.templateHtml);
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toBe(prepared.styleCss);
      expect(stdout.text).toContain("Wrote Markdown PDF template:");
      expectNoStderr();
    });
  });

  test("prepares and binds an explicit destination without writing", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "reviewed-template");
      const { runtime } = createActionTestRuntime();

      const prepared = prepareMarkdownPdfTemplateInit(
        normalizeMarkdownPdfOptions({
          marginX: "24MM",
          preset: "reader",
          toc: true,
        }),
      );
      const destination = await bindPreparedMarkdownPdfTemplateInitDestination(runtime, prepared, {
        output: toRepoRelativePath(outputDir),
      });

      expect(prepared.normalizedOptions.margins.left).toBe("24mm");
      expect(prepared.normalizedOptions.margins.right).toBe("24mm");
      expect(prepared.templateHtml).toContain("$body$");
      expect(prepared.styleCss).toContain("margin: 20mm 24mm 20mm 24mm");
      expect(destination.outputDirectory).toBe(outputDir);
      expect(destination.prepared).toBe(prepared);
      expect(await readdir(fixtureDir)).toEqual([]);
    });
  });

  test("rebinds and writes the exact accepted prepared artifact", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const firstOutputDir = join(fixtureDir, "first-template");
      const acceptedOutputDir = join(fixtureDir, "accepted-template");
      const { runtime } = createActionTestRuntime();
      const prepared = prepareMarkdownPdfTemplateInit(
        normalizeMarkdownPdfOptions({
          orientation: "landscape",
          preset: "report",
          toc: true,
        }),
      );
      const acceptedTemplate = prepared.templateHtml;
      const acceptedStyle = prepared.styleCss;

      await bindPreparedMarkdownPdfTemplateInitDestination(runtime, prepared, {
        output: toRepoRelativePath(firstOutputDir),
      });
      const acceptedDestination = await bindPreparedMarkdownPdfTemplateInitDestination(
        runtime,
        prepared,
        {
          output: toRepoRelativePath(acceptedOutputDir),
        },
      );
      prepared.normalizedOptions.orientation = "portrait";
      await writePreparedMarkdownPdfTemplateInit(acceptedDestination);

      expect(await readdir(fixtureDir)).toEqual(["accepted-template"]);
      expect(await readFile(join(acceptedOutputDir, "template.html"), "utf8")).toBe(
        acceptedTemplate,
      );
      expect(await readFile(join(acceptedOutputDir, "style.css"), "utf8")).toBe(acceptedStyle);
    });
  });

  test("does not invent an output directory fallback", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const prepared = prepareMarkdownPdfTemplateInit(normalizeMarkdownPdfOptions());

    await expectCliError(
      () => bindPreparedMarkdownPdfTemplateInitDestination(runtime, prepared, { output: " " }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Output path is required",
      },
    );

    expectNoOutput();
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

  test("leaves an existing bundle unchanged when either overwrite target is invalid", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const templatePath = join(outputDir, "template.html");
      const stylePath = join(outputDir, "style.css");
      await mkdir(stylePath, { recursive: true });
      await writeFile(templatePath, "old template", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfTemplateInit(runtime, {
            output: toRepoRelativePath(outputDir),
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Markdown PDF stylesheet is not a file",
        },
      );

      expect(await readFile(templatePath, "utf8")).toBe("old template");
      expect(await readdir(stylePath)).toEqual([]);
      expectNoOutput();
    });
  });
});
