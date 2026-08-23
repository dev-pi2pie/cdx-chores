import { describe, expect, test } from "bun:test";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { actionMdToPdf } from "../../../src/cli/actions";
import { createPdfRunner } from "./render-support";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("Markdown PDF rendering template asset safety", () => {
  test("rejects a dangling PDF output symlink at the final write boundary", async () => {
    await withTempFixtureDir("md-to-pdf-output-dangling-symlink", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const targetPath = join(fixtureDir, "generated-profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await symlink(targetPath, outputPath);
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          overwrite: true,
          runner,
        }),
      ).rejects.toMatchObject({ code: "OUTPUT_SYMLINK" });

      await expect(readFile(targetPath)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("rejects a PDF output through a symlinked parent directory", async () => {
    await withTempFixtureDir("md-to-pdf-output-parent-symlink", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const realOutputDirectory = join(fixtureDir, "real-output");
      const outputAliasDirectory = join(fixtureDir, "output-alias");
      const outputPath = join(outputAliasDirectory, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await mkdir(realOutputDirectory);
      await symlink(realOutputDirectory, outputAliasDirectory);
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          overwrite: true,
          runner,
        }),
      ).rejects.toMatchObject({ code: "OUTPUT_SYMLINK" });

      await expect(readFile(join(realOutputDirectory, "report.pdf"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });

  test("rejects missing custom template assets before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-missing-asset", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template", "template.html");
      await mkdir(dirname(customTemplate), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customTemplate,
        '<html><body><img src="assets/missing.png">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path does not exist");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects custom template asset traversal before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-asset-traversal", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template", "template.html");
      const outsideAsset = join(fixtureDir, "outside.png");
      await mkdir(dirname(customTemplate), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outsideAsset, "outside", "utf8");
      await writeFile(
        customTemplate,
        '<html><body><img src="../outside.png">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path must stay inside");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects custom template absolute local asset references before rendering", async () => {
    const scenarios = [
      { label: "root-relative", reference: "/private/cover.png" },
      { label: "windows-absolute", reference: "C:\\private\\cover.png" },
      { label: "file-url", reference: "file:///private/cover.png" },
    ] as const;

    for (const scenario of scenarios) {
      await withTempFixtureDir(
        `md-to-pdf-template-absolute-asset-${scenario.label}`,
        async (fixtureDir) => {
          const inputPath = join(fixtureDir, "report.md");
          const customTemplate = join(fixtureDir, "template", "template.html");
          await mkdir(dirname(customTemplate), { recursive: true });
          await writeFile(inputPath, "# Report\n", "utf8");
          await writeFile(
            customTemplate,
            `<html><body><img src="${scenario.reference}">$body$</body></html>`,
            "utf8",
          );
          const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
          const { runtime } = createActionTestRuntime();

          await expect(
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              template: toRepoRelativePath(customTemplate),
              runner,
            }),
          ).rejects.toThrow("Template asset path must");

          expect(
            calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
          ).toBe(false);
          expect(
            calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
          ).toBe(false);
        },
      );
    }
  });

  test("rejects custom template asset references with Pandoc variables before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-asset-variable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template", "template.html");
      await mkdir(dirname(customTemplate), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customTemplate,
        '<html><body><img src="$if(cover)$assets/cover.png$endif$">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path must not contain Pandoc template variables");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects custom template asset symlink escapes before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-asset-symlink", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const templateDir = join(fixtureDir, "template");
      const customTemplate = join(templateDir, "template.html");
      const linkAsset = join(templateDir, "assets", "cover.png");
      const outsideAsset = join(fixtureDir, "outside.png");
      await mkdir(dirname(linkAsset), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outsideAsset, "outside", "utf8");
      await symlink(outsideAsset, linkAsset);
      await writeFile(
        customTemplate,
        '<html><body><img src="assets/cover.png">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path must stay inside");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects a reserved logical-final target before HTML output or WeasyPrint rendering", async () => {
    await withTempFixtureDir("md-to-pdf-logical-target-conflict", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "pageNumbers:",
          "  enabled: true",
          "  scope: body",
          "  countFrom: body",
          '  format: "{page} / {pages}"',
          "",
        ].join("\n"),
        "utf8",
      );
      const { calls, runner } = createPdfRunner({
        html: [
          "<html><body>",
          '<main class="document-body">Report</main>',
          '<span id="cdx-markdown-pdf-logical-final"></span>',
          "</body></html>",
        ].join(""),
      });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          htmlOutput: toRepoRelativePath(htmlOutput),
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          profile: toRepoRelativePath(profilePath),
          runner,
        }),
      ).rejects.toMatchObject({
        code: "MARKDOWN_PDF_LOGICAL_TARGET_CONFLICT",
        exitCode: 2,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      await expect(readFile(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(htmlOutput)).rejects.toMatchObject({ code: "ENOENT" });
      expectNoOutput();
    });
  });
});
