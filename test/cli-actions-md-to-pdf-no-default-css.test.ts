import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import {
  findMarkdownPdfRenderConfigurationConflict,
  MARKDOWN_PDF_PAGE_NUMBERS_REQUIRE_DEFAULT_CSS_REASON,
} from "../src/cli/actions/markdown/to-pdf-service";
import { resolveMarkdownPdfPageNumberConfiguration } from "../src/cli/markdown-pdf";
import { MARKDOWN_PDF_COVER_DEFAULT_CSS_DISABLED_WARNING } from "../src/cli/markdown-pdf";
import { DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE } from "../src/cli/markdown-pdf/profile";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

async function expectMissing(path: string): Promise<void> {
  await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("Markdown PDF page numbers with no default CSS", () => {
  test("preserves a stable internal reason and effective configuration context", () => {
    const pageNumbers = resolveMarkdownPdfPageNumberConfiguration({
      profile: DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
      profileSource: "default",
      override: true,
    });

    expect(findMarkdownPdfRenderConfigurationConflict({ noDefaultCss: true, pageNumbers })).toEqual(
      {
        reason: MARKDOWN_PDF_PAGE_NUMBERS_REQUIRE_DEFAULT_CSS_REASON,
        noDefaultCss: true,
        pageNumbers,
      },
    );
    expect(findMarkdownPdfRenderConfigurationConflict({ noDefaultCss: false, pageNumbers })).toBe(
      undefined,
    );
  });

  test.each([
    {
      bundleProfile: undefined,
      directOverride: true,
      explicitProfile: undefined,
      label: "direct enable without a Profile",
    },
    {
      bundleProfile: undefined,
      directOverride: undefined,
      explicitProfile: true,
      label: "enabled explicit Profile",
    },
    {
      bundleProfile: undefined,
      directOverride: true,
      explicitProfile: false,
      label: "direct enable over a disabled explicit Profile",
    },
    {
      bundleProfile: true,
      directOverride: undefined,
      explicitProfile: undefined,
      label: "enabled bundle Profile",
    },
    {
      bundleProfile: "enabled-with-style" as const,
      directOverride: undefined,
      explicitProfile: undefined,
      label: "enabled bundle Profile with a custom stylesheet counter",
    },
    {
      bundleProfile: undefined,
      directOverride: true,
      explicitProfile: undefined,
      label: "direct enable with an explicit custom stylesheet counter",
      withExplicitCss: true,
    },
  ])("rejects $label before output resolution or render probes", async (scenario) => {
    await withTempFixtureDir("md-to-pdf-no-default-css-reject", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const bundleDirectory = join(fixtureDir, "bundle");
      const explicitCssPath = join(fixtureDir, "custom.css");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      if (scenario.explicitProfile !== undefined) {
        await writeFile(
          profilePath,
          `pageNumbers:\n  enabled: ${scenario.explicitProfile}\n`,
          "utf8",
        );
      }
      if (scenario.bundleProfile !== undefined) {
        await mkdir(bundleDirectory);
        await writeFile(
          join(bundleDirectory, "profile.yml"),
          "pageNumbers:\n  enabled: true\n",
          "utf8",
        );
        if (scenario.bundleProfile === "enabled-with-style") {
          await writeFile(
            join(bundleDirectory, "style.css"),
            "@page { @bottom-center { content: counter(page); } }\n",
            "utf8",
          );
        }
      }
      if (scenario.withExplicitCss) {
        await writeFile(
          explicitCssPath,
          "@page { @bottom-center { content: counter(page); } }\n",
          "utf8",
        );
      }
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            bundle:
              scenario.bundleProfile === undefined
                ? undefined
                : toRepoRelativePath(bundleDirectory),
            profile:
              scenario.explicitProfile === undefined ? undefined : toRepoRelativePath(profilePath),
            css: scenario.withExplicitCss ? toRepoRelativePath(explicitCssPath) : undefined,
            pageNumbers: scenario.directOverride,
            noDefaultCss: true,
            runner,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Effective page numbers require the generated default stylesheet",
        },
      );

      expect(calls).toHaveLength(0);
      await expectMissing(outputPath);
      await expectMissing(htmlOutputPath);
      const expectedEntries = ["report.md"];
      if (scenario.explicitProfile !== undefined) {
        expectedEntries.push("profile.yml");
      }
      if (scenario.bundleProfile !== undefined) {
        expectedEntries.push("bundle");
      }
      if (scenario.withExplicitCss) {
        expectedEntries.push("custom.css");
      }
      expect((await readdir(fixtureDir)).sort()).toEqual(expectedEntries.sort());
      expectNoOutput();
    });
  });

  test("renders a cover-only Profile with one custom-CSS ownership warning", async () => {
    await withTempFixtureDir("md-to-pdf-no-default-css-cover-baseline", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "---\ntitle: Cover title\n---\n# Report\n", "utf8");
      await writeFile(profilePath, "cover:\n  enabled: true\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        noDefaultCss: true,
        runner,
      });

      expect(calls.some((call) => call.command === "weasyprint")).toBe(true);
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(
        stderr.text.match(new RegExp(MARKDOWN_PDF_COVER_DEFAULT_CSS_DISABLED_WARNING, "g")),
      ).toHaveLength(1);
      expect(stderr.text).not.toContain("\u001b");
    });
  });

  test("keeps the page-number hard error authoritative when cover and page numbers are enabled", async () => {
    await withTempFixtureDir("md-to-pdf-no-default-css-cover-page-numbers", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        "cover:\n  enabled: true\npageNumbers:\n  enabled: true\n",
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            profile: toRepoRelativePath(profilePath),
            noDefaultCss: true,
            runner,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Effective page numbers require the generated default stylesheet",
        },
      );

      expect(calls).toHaveLength(0);
      await expectMissing(outputPath);
      expectNoOutput();
    });
  });

  test.each([
    {
      bundleProfile: undefined,
      directOverride: undefined,
      explicitProfile: undefined,
      label: "normalized default",
    },
    {
      bundleProfile: undefined,
      directOverride: undefined,
      explicitProfile: false,
      label: "disabled explicit Profile",
    },
    {
      bundleProfile: undefined,
      directOverride: false,
      explicitProfile: true,
      label: "direct disable over an enabled explicit Profile",
    },
    {
      bundleProfile: true,
      directOverride: false,
      explicitProfile: undefined,
      label: "direct disable over an enabled bundle Profile",
    },
  ])("preserves deliberate custom counters for $label", async (scenario) => {
    await withTempFixtureDir("md-to-pdf-no-default-css-custom-counter", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const bundleDirectory = join(fixtureDir, "bundle");
      const explicitCssPath = join(fixtureDir, "custom.css");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      if (scenario.explicitProfile !== undefined) {
        await writeFile(
          profilePath,
          `pageNumbers:\n  enabled: ${scenario.explicitProfile}\n`,
          "utf8",
        );
      }
      let selectedCssPath = explicitCssPath;
      if (scenario.bundleProfile !== undefined) {
        await mkdir(bundleDirectory);
        await writeFile(
          join(bundleDirectory, "profile.yml"),
          `pageNumbers:\n  enabled: ${scenario.bundleProfile}\n`,
          "utf8",
        );
        selectedCssPath = join(bundleDirectory, "style.css");
      }
      await writeFile(
        selectedCssPath,
        "@page { @bottom-center { content: counter(page); } }\n",
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle:
          scenario.bundleProfile === undefined ? undefined : toRepoRelativePath(bundleDirectory),
        profile:
          scenario.explicitProfile === undefined ? undefined : toRepoRelativePath(profilePath),
        css: scenario.bundleProfile === undefined ? toRepoRelativePath(explicitCssPath) : undefined,
        pageNumbers: scenario.directOverride,
        noDefaultCss: true,
        runner,
      });

      const weasyprintCall = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintCall?.args.filter((argument) => argument === "--stylesheet")).toHaveLength(
        1,
      );
      expect(weasyprintCall?.args).toContain(selectedCssPath);
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });
});
