import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import { createPdfRunner, createRemoteInlineCssHtml } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf assets", () => {
  test("blocks remote CSS assets by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "remote.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '@import "https://example.com/print.css";\n.logo { background: url("https://example.com/logo.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const error = await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            css: toRepoRelativePath(customCss),
            runner,
          }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "https://example.com/print.css",
        },
      );

      expect(error.message).toContain("https://example.com/logo.png");
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("blocks remote assets in inline HTML CSS by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: createRemoteInlineCssHtml() });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const error = await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(inputPath), runner }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "https://example.com/print.css",
        },
      );

      expect(error.message).toContain("https://example.com/banner.png");
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("allows remote assets in inline HTML CSS with explicit opt in", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: createRemoteInlineCssHtml() });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        allowRemoteAssets: true,
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("allows remote CSS assets with explicit opt in", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "remote.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '@import "https://example.com/print.css";\n.logo { background: url("https://example.com/logo.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        css: toRepoRelativePath(customCss),
        allowRemoteAssets: true,
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("blocks non-local asset schemes by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "remote.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '.remote { background: url("ftp://example.com/logo.png"); }\n.protocol { background: url("//example.com/banner.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const error = await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            css: toRepoRelativePath(customCss),
            runner,
          }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "ftp://example.com/logo.png",
        },
      );

      expect(error.message).toContain("//example.com/banner.png");
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("allows local file and data asset URLs by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "local.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '.data { background: url("data:image/png;base64,AAAA"); }\n.file { background: url("file:///tmp/logo.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="file:///tmp/chart.png"></body></html>',
      });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        css: toRepoRelativePath(customCss),
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("blocks remote image assets by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n\n![Remote](https://example.com/chart.png)\n", "utf8");
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="https://example.com/chart.png"></body></html>',
      });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(inputPath), runner }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "Remote assets are disabled by default",
        },
      );

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("allows remote image assets with explicit opt in", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n\n![Remote](https://example.com/chart.png)\n", "utf8");
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="https://example.com/chart.png"></body></html>',
      });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        allowRemoteAssets: true,
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });
});
