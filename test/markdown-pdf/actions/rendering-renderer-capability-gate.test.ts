import { describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../../../src/cli/actions";
import {
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_RENDERER_CAPABILITY_IDS,
} from "../../../src/cli/markdown-pdf";
import type { MarkdownPdfProcessRunner } from "../../../src/cli/markdown-pdf";
import { createPdfRunner, failing, ok } from "../../cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

function runnerWithWeasyPrintVersion(version: string): {
  calls: Array<{ command: string; args: string[] }>;
  runner: MarkdownPdfProcessRunner;
} {
  const calls: Array<{ command: string; args: string[] }> = [];
  const { runner: baseRunner } = createPdfRunner({
    html: '<html><body><main class="document-body">Report</main></body></html>',
  });
  return {
    calls,
    runner: async (command, args, options) => {
      calls.push({ command, args });
      if (command === "weasyprint" && args.includes("--info")) {
        return ok(`WeasyPrint version ${version}\n`);
      }
      return await baseRunner(command, args, options);
    },
  };
}

async function expectMissing(path: string): Promise<void> {
  await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
}

function fullAdvancedProfileSource(numberingBoundary: "body" | "document"): string {
  return [
    "header:",
    "  left: Advanced header",
    "  style:",
    "    fontSize: 8pt",
    "    fontWeight: 500",
    "    lineHeight: 1.2",
    '    color: "#123456"',
    "    separator:",
    "      width: 0.5pt",
    "      style: solid",
    '      color: "#abcdef"',
    "      gap: 0",
    "pageNumbers:",
    "  enabled: true",
    "  start: 0",
    "  increment: 2",
    `  scope: ${numberingBoundary}`,
    `  countFrom: ${numberingBoundary}`,
    "",
  ].join("\n");
}

describe("Markdown PDF renderer capability gate", () => {
  test.each([
    ["pdfPage", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalCurrent],
    ["pdfPages", MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalTotal],
  ] as const)(
    "rejects a format-only {%s} capability on WeasyPrint 65.0 before outputs",
    async (token, capabilityId) => {
      await withTempFixtureDir(`md-pdf-capability-${token}-reject`, async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "report.pdf");
        const htmlOutputPath = join(fixtureDir, "report.html");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(
          profilePath,
          `pageNumbers:\n  enabled: true\n  format: "{${token}}"\n`,
          "utf8",
        );
        const { calls, runner } = runnerWithWeasyPrintVersion("65.0");
        const { runtime, expectNoOutput } = createActionTestRuntime();

        await expectCliError(
          () =>
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              profile: toRepoRelativePath(profilePath),
              output: toRepoRelativePath(outputPath),
              htmlOutput: toRepoRelativePath(htmlOutputPath),
              runner,
            }),
          {
            code: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported,
            exitCode: 2,
            messageIncludes: `${capabilityId} (pageNumbers.format; minimum 65.1)`,
          },
        );

        expect(calls).toEqual([
          { command: "pandoc", args: ["--version"] },
          { command: "weasyprint", args: ["--info"] },
        ]);
        await expectMissing(outputPath);
        await expectMissing(htmlOutputPath);
        expectNoOutput();
      });
    },
  );

  test.each(["pdfPage", "pdfPages"] as const)(
    "renders a format-only {%s} capability at the WeasyPrint 65.1 baseline",
    async (token) => {
      await withTempFixtureDir(`md-pdf-capability-${token}-accept`, async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "report.pdf");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(
          profilePath,
          `pageNumbers:\n  enabled: true\n  format: "{${token}}"\n`,
          "utf8",
        );
        const { runner } = runnerWithWeasyPrintVersion("65.1");
        const { runtime, expectNoStderr } = createActionTestRuntime();

        await actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          profile: toRepoRelativePath(profilePath),
          output: toRepoRelativePath(outputPath),
          runner,
        });

        expect(await readFile(outputPath, "utf8")).toContain("%PDF");
        expectNoStderr();
      });
    },
  );

  test.each(["65.0", "custom-build"])(
    "keeps the basic render path on WeasyPrint %s when no advanced control is effective",
    async (version) => {
      await withTempFixtureDir("md-pdf-capability-basic", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "report.pdf");
        await writeFile(inputPath, "# Report\n", "utf8");
        const { calls, runner } = runnerWithWeasyPrintVersion(version);
        const { runtime, expectNoStderr } = createActionTestRuntime();

        await actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          runner,
        });

        expect(await readFile(outputPath, "utf8")).toContain("%PDF");
        expect(
          calls.filter(({ command, args }) => command === "weasyprint" && args.includes("--info")),
        ).toHaveLength(1);
        expectNoStderr();
      });
    },
  );

  test.each([
    ["65.0", MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported],
    ["custom-build", MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnverified],
  ])(
    "rejects advanced controls on WeasyPrint %s before any output write",
    async (version, code) => {
      await withTempFixtureDir("md-pdf-capability-reject", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "report.pdf");
        const htmlOutputPath = join(fixtureDir, "report.html");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(profilePath, "pageNumbers:\n  enabled: true\n  start: 0\n", "utf8");
        const { calls, runner } = runnerWithWeasyPrintVersion(version);
        const { runtime, expectNoOutput } = createActionTestRuntime();

        await expectCliError(
          () =>
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              profile: toRepoRelativePath(profilePath),
              output: toRepoRelativePath(outputPath),
              htmlOutput: toRepoRelativePath(htmlOutputPath),
              runner,
            }),
          {
            code,
            exitCode: 2,
            messageIncludes: "pageNumbers.start",
          },
        );

        expect(calls).toEqual([
          { command: "pandoc", args: ["--version"] },
          { command: "weasyprint", args: ["--info"] },
        ]);
        await expectMissing(outputPath);
        await expectMissing(htmlOutputPath);
        expectNoOutput();
      });
    },
  );

  test("uses the direct effective disable to avoid an advanced request", async () => {
    await withTempFixtureDir("md-pdf-capability-effective-disable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "pageNumbers:\n  enabled: true\n  start: 0\n", "utf8");
      const { runner } = runnerWithWeasyPrintVersion("65.0");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        pageNumbers: false,
        output: toRepoRelativePath(outputPath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });

  test("uses the direct effective enable to gate advanced controls from a disabled Profile", async () => {
    await withTempFixtureDir("md-pdf-capability-effective-enable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "pageNumbers:\n  enabled: false\n  start: 0\n", "utf8");
      const { calls, runner } = runnerWithWeasyPrintVersion("65.0");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            profile: toRepoRelativePath(profilePath),
            pageNumbers: true,
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            runner,
          }),
        {
          code: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported,
          exitCode: 2,
          messageIncludes: "pageNumbers.start",
        },
      );

      expect(calls).toEqual([
        { command: "pandoc", args: ["--version"] },
        { command: "weasyprint", args: ["--info"] },
      ]);
      await expectMissing(outputPath);
      await expectMissing(htmlOutputPath);
      expectNoOutput();
    });
  });

  test("runs an old renderer when configured styles have no effective area", async () => {
    await withTempFixtureDir("md-pdf-capability-empty-style-area", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, 'header:\n  style:\n    color: "#123456"\n', "utf8");
      const { runner } = runnerWithWeasyPrintVersion("65.0");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        output: toRepoRelativePath(outputPath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });

  test("rejects an effective styled area on an old renderer before output writes", async () => {
    await withTempFixtureDir("md-pdf-capability-effective-style", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        'header:\n  left: Header\n  style:\n    color: "#123456"\n',
        "utf8",
      );
      const { calls, runner } = runnerWithWeasyPrintVersion("65.0");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            profile: toRepoRelativePath(profilePath),
            output: toRepoRelativePath(outputPath),
            runner,
          }),
        {
          code: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported,
          exitCode: 2,
          messageIncludes: "header.style.color",
        },
      );

      expect(calls).toEqual([
        { command: "pandoc", args: ["--version"] },
        { command: "weasyprint", args: ["--info"] },
      ]);
      await expectMissing(outputPath);
      expectNoOutput();
    });
  });

  test.each([
    ["probe failure", "throw", MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityProbeFailed],
    [
      "missing renderer",
      "missing",
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityMissing,
    ],
  ] as const)(
    "maps advanced-request %s to its stable capability diagnostic",
    async (_label, failure, code) => {
      await withTempFixtureDir("md-pdf-capability-dependency", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "report.pdf");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(profilePath, "pageNumbers:\n  enabled: true\n  start: 0\n", "utf8");
        const { runner: baseRunner } = createPdfRunner({ html: "<html></html>" });
        const runner: MarkdownPdfProcessRunner = async (command, args, options) => {
          if (command === "weasyprint" && args[0]?.startsWith("--")) {
            if (failure === "throw") {
              throw new Error("renderer probe failed");
            }
            return failing("renderer missing");
          }
          return await baseRunner(command, args, options);
        };
        const { runtime, expectNoOutput } = createActionTestRuntime();

        await expectCliError(
          () =>
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              profile: toRepoRelativePath(profilePath),
              output: toRepoRelativePath(outputPath),
              runner,
            }),
          { code, exitCode: 2, messageIncludes: "pageNumbers.start" },
        );

        await expectMissing(outputPath);
        expectNoOutput();
      });
    },
  );

  test.each([
    ["probe failure", "throw", "DEPENDENCY_CHECK_FAILED"],
    ["missing renderer", "missing", "DEPENDENCY_MISSING"],
  ] as const)("preserves the basic-path %s diagnostic", async (_label, failure, code) => {
    await withTempFixtureDir("md-pdf-capability-basic-dependency", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runner: baseRunner } = createPdfRunner({ html: "<html></html>" });
      const runner: MarkdownPdfProcessRunner = async (command, args, options) => {
        if (command === "weasyprint" && args[0]?.startsWith("--")) {
          if (failure === "throw") {
            throw new Error("renderer probe failed");
          }
          return failing("renderer missing");
        }
        return await baseRunner(command, args, options);
      };
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            runner,
          }),
        { code, exitCode: 2 },
      );

      await expectMissing(outputPath);
      expectNoOutput();
    });
  });

  test("accepts advanced controls at the 65.1 baseline", async () => {
    await withTempFixtureDir("md-pdf-capability-baseline", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "pageNumbers:\n  enabled: true\n  start: 0\n", "utf8");
      const { runner } = runnerWithWeasyPrintVersion("65.1");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        output: toRepoRelativePath(outputPath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });

  test.each(["body", "document"] as const)(
    "renders the full styled %s-numbering advanced Profile at the baseline",
    async (numberingBoundary) => {
      await withTempFixtureDir("md-pdf-capability-full-baseline", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "report.pdf");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(profilePath, fullAdvancedProfileSource(numberingBoundary), "utf8");
        const { calls, runner } = runnerWithWeasyPrintVersion("65.1");
        const { runtime } = createActionTestRuntime();

        await actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          profile: toRepoRelativePath(profilePath),
          output: toRepoRelativePath(outputPath),
          runner,
        });

        expect(await readFile(outputPath, "utf8")).toContain("%PDF");
        expect(calls.some(({ command }) => command === "pandoc")).toBeTrue();
        expect(
          calls.some(({ command, args }) => command === "weasyprint" && !args.includes("--info")),
        ).toBeTrue();
      });
    },
  );

  test.each([
    ["65.0", MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported],
    ["custom-build", MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnverified],
  ])(
    "rejects a combined advanced Profile on WeasyPrint %s before render or output",
    async (version, code) => {
      await withTempFixtureDir("md-pdf-capability-full-reject", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "report.pdf");
        const htmlOutputPath = join(fixtureDir, "report.html");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(profilePath, fullAdvancedProfileSource("body"), "utf8");
        const { calls, runner } = runnerWithWeasyPrintVersion(version);
        const { runtime, expectNoOutput } = createActionTestRuntime();

        await expectCliError(
          () =>
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              profile: toRepoRelativePath(profilePath),
              output: toRepoRelativePath(outputPath),
              htmlOutput: toRepoRelativePath(htmlOutputPath),
              runner,
            }),
          { code, exitCode: 2, messageIncludes: "pageChrome.separator.gap" },
        );

        expect(calls).toEqual([
          { command: "pandoc", args: ["--version"] },
          { command: "weasyprint", args: ["--info"] },
        ]);
        await expectMissing(outputPath);
        await expectMissing(htmlOutputPath);
        expectNoOutput();
      });
    },
  );
});
