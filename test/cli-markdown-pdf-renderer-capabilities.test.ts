import { describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import type { CommandStatus } from "../src/cli/deps";
import { CliError } from "../src/cli/errors";
import {
  assertMarkdownPdfRendererCapabilities,
  assessMarkdownPdfRendererCapabilities,
  collectMarkdownPdfRendererCapabilityRequests,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION,
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY,
  MARKDOWN_PDF_RENDERER_CAPABILITY_IDS,
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX,
} from "../src/cli/markdown-pdf";
import {
  markdownPdfProfileRendererCapabilities,
  markdownPdfProfileRendererCapabilityFields,
} from "../src/cli/markdown-pdf/profile";
import type {
  MarkdownPdfProcessRunner,
  MarkdownPdfRendererCapabilityId,
  MarkdownPdfRendererCapabilityStatus,
  NormalizedMarkdownPdfProfile,
} from "../src/cli/markdown-pdf";
import { createPdfRunner, failing, ok } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function rendererStatus(input: { available?: boolean; version?: string | null }): CommandStatus {
  return {
    name: "weasyprint",
    available: input.available ?? true,
    version: input.version ?? null,
    installHint: "install weasyprint",
  };
}

function profileWithAdvancedControls(): NormalizedMarkdownPdfProfile {
  const style = {
    fontSize: "8.5pt",
    fontWeight: 500 as const,
    lineHeight: 1.2,
    color: "#123456",
    separator: {
      width: "0.5pt",
      style: "solid" as const,
      color: "#abcdef",
      gap: 0 as const,
    },
  };
  return {
    ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
    header: {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.header,
      left: "Header",
      style,
    },
    footer: {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.footer,
      style,
    },
    pageNumbers: {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
      enabled: true,
      position: "bottom-center",
      scope: "body",
      countFrom: "body",
      start: 0,
      increment: 2,
    },
  };
}

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

const CAPABILITY_FIELD_CASES = MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.flatMap((capability) =>
  capability.fields.map((field) => [capability.id, field] as const),
);

describe("Markdown PDF renderer capability matrix", () => {
  test("records every advanced field against the 65.1 evidence baseline", () => {
    expect(MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX).toHaveLength(15);
    expect(
      MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map(({ id, minimumVersion }) => [id, minimumVersion]),
    ).toEqual([
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberBodyOrigin, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberLogicalFinal, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalCurrent, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalTotal, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontWeight, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeLineHeight, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorWidth, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorStyle, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorColor, "65.1"],
      [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap, "65.1"],
    ]);
    expect(MARKDOWN_PDF_ADVANCED_WEASYPRINT_MINIMUM_VERSION).toBe("65.1");
    const registeredCapabilityIds = new Set(
      MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.flatMap((definition) => [
        ...(definition.rendererCapability ? [definition.rendererCapability] : []),
        ...(definition.values?.flatMap((value) =>
          value.rendererCapability ? [value.rendererCapability] : [],
        ) ?? []),
        ...(definition.tokens?.flatMap((token) =>
          token.rendererCapability ? [token.rendererCapability] : [],
        ) ?? []),
      ]),
    );
    expect(registeredCapabilityIds).toEqual(
      new Set(MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.map(({ id }) => id)),
    );
    expect(MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.every(({ fields }) => fields.length > 0)).toBe(
      true,
    );
    expect(
      MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.find(
        ({ id }) => id === MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap,
      )?.fields,
    ).toEqual(["header.style.separator.gap", "footer.style.separator.gap"]);
  });

  test("collects separate effective requests and retains the originating fields", () => {
    const profile = profileWithAdvancedControls();
    const requests = collectMarkdownPdfRendererCapabilityRequests({
      profile,
      pageNumbers: profile.pageNumbers,
    });

    expect(requests).toEqual([
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
        requestedBy: ["pageNumbers.start"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement,
        requestedBy: ["pageNumbers.increment"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberBodyOrigin,
        requestedBy: ["pageNumbers.countFrom"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize,
        requestedBy: ["header.style.fontSize", "footer.style.fontSize"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontWeight,
        requestedBy: ["header.style.fontWeight", "footer.style.fontWeight"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeLineHeight,
        requestedBy: ["header.style.lineHeight", "footer.style.lineHeight"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor,
        requestedBy: ["header.style.color", "footer.style.color"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorWidth,
        requestedBy: ["header.style.separator.width", "footer.style.separator.width"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorStyle,
        requestedBy: ["header.style.separator.style", "footer.style.separator.style"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorColor,
        requestedBy: ["header.style.separator.color", "footer.style.separator.color"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeSeparatorGap,
        requestedBy: ["header.style.separator.gap", "footer.style.separator.gap"],
      },
    ]);

    const documentProfile: NormalizedMarkdownPdfProfile = {
      ...profile,
      pageNumbers: {
        ...profile.pageNumbers,
        scope: "document",
        countFrom: "document",
      },
    };
    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile: documentProfile,
        pageNumbers: documentProfile.pageNumbers,
      }).find(
        ({ capabilityId }) =>
          capabilityId === MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope,
      ),
    ).toEqual({
      capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberDocumentScope,
      requestedBy: ["pageNumbers.scope"],
    });
  });

  test("collects token capabilities only from an enabled effective format", () => {
    const profile = profileWithAdvancedControls();
    const pageNumbers = {
      ...profile.pageNumbers,
      format: "{page}/{pages} ({pdfPage}/{pdfPages}) {pages} {Page} {pdfPagesx}",
    };
    const requests = collectMarkdownPdfRendererCapabilityRequests({ profile, pageNumbers });
    expect(
      requests.filter(({ requestedBy }) => requestedBy.includes("pageNumbers.format")),
    ).toEqual([
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberLogicalFinal,
        requestedBy: ["pageNumbers.format"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalCurrent,
        requestedBy: ["pageNumbers.format"],
      },
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalTotal,
        requestedBy: ["pageNumbers.format"],
      },
    ]);

    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile,
        pageNumbers: { ...pageNumbers, enabled: false },
      }).some(({ requestedBy }) => requestedBy.includes("pageNumbers.format")),
    ).toBe(false);
    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile,
        pageNumbers: { ...pageNumbers, format: "{page} {Page} {pdfPagesx}" },
      }).some(({ requestedBy }) => requestedBy.includes("pageNumbers.format")),
    ).toBe(false);
  });

  test.each([
    ["{page}", []],
    ["{pages}", [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberLogicalFinal]],
    ["{pdfPage}", [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalCurrent]],
    ["{pdfPages}", [MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalTotal]],
    ["{Page}", []],
    ["{pagesx}", []],
    ["{pdfpage}", []],
    ["{pdfPages.more}", []],
  ] as const)("maps exact format token %s to its registered capability", (format, expected) => {
    expect(markdownPdfProfileRendererCapabilities("pageNumbers.format", format)).toEqual(expected);
  });

  test("maps every format capability back to the shared Profile field", () => {
    for (const capabilityId of [
      MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberLogicalFinal,
      MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalCurrent,
      MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberPhysicalTotal,
    ]) {
      expect(markdownPdfProfileRendererCapabilityFields(capabilityId)).toEqual([
        "pageNumbers.format",
      ]);
    }
  });

  test("gates styles only for occupied areas or the enabled page-number target", () => {
    const styledEmptyProfile: NormalizedMarkdownPdfProfile = {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
      header: {
        ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.header,
        style: { color: "#123456", separator: {} },
      },
      footer: {
        ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.footer,
        style: { fontSize: "8pt" },
      },
    };

    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile: styledEmptyProfile,
        pageNumbers: styledEmptyProfile.pageNumbers,
      }),
    ).toEqual([]);

    const withHeader = {
      ...styledEmptyProfile,
      header: { ...styledEmptyProfile.header, left: "Header" },
    };
    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile: withHeader,
        pageNumbers: withHeader.pageNumbers,
      }),
    ).toEqual([
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeColor,
        requestedBy: ["header.style.color"],
      },
    ]);

    const pageNumbers = { ...styledEmptyProfile.pageNumbers, enabled: true };
    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile: styledEmptyProfile,
        pageNumbers,
      }),
    ).toEqual([
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize,
        requestedBy: ["footer.style.fontSize"],
      },
    ]);

    expect(
      collectMarkdownPdfRendererCapabilityRequests({
        profile: styledEmptyProfile,
        pageNumbers: { ...pageNumbers, format: "" },
      }),
    ).toEqual([
      {
        capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageChromeFontSize,
        requestedBy: ["footer.style.fontSize"],
      },
    ]);
  });

  test.each(CAPABILITY_FIELD_CASES)(
    "rejects unsupported request %s from field %s",
    (capabilityId, field) => {
      const assessment = assessMarkdownPdfRendererCapabilities({
        renderer: rendererStatus({ version: "65.0" }),
      });

      expect(() =>
        assertMarkdownPdfRendererCapabilities({
          assessment,
          requests: [{ capabilityId, requestedBy: [field] }],
        }),
      ).toThrow(
        expect.objectContaining({
          code: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported,
          message: expect.stringContaining(field),
        }),
      );
    },
  );

  test.each([
    [rendererStatus({ version: "65.1" }), false, "satisfied"],
    [rendererStatus({ version: "69.0" }), false, "satisfied"],
    [rendererStatus({ version: "65.0" }), false, "unsupported"],
    [rendererStatus({ version: "custom-build" }), false, "unverified"],
    [rendererStatus({ available: false }), false, "missing"],
    [undefined, true, "probe-failed"],
    [undefined, false, "unknown"],
  ] as const)("maps renderer state to %s capability status", (renderer, probeFailed, expected) => {
    const assessment = assessMarkdownPdfRendererCapabilities({ renderer, probeFailed });
    expect(new Set(assessment.capabilities.map(({ status }) => status))).toEqual(
      new Set([expected as MarkdownPdfRendererCapabilityStatus]),
    );
    if (expected !== "satisfied") {
      expect(assessment.capabilities[0]?.diagnosticConditionId).toBe(
        {
          missing: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityMissing,
          unsupported: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported,
          unverified: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnverified,
          "probe-failed": MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityProbeFailed,
          unknown: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnknown,
        }[expected],
      );
    }
  });

  test("fails only requested unavailable capabilities with their stable diagnostic ID", () => {
    const assessment = assessMarkdownPdfRendererCapabilities({
      renderer: rendererStatus({ version: "65.0" }),
    });
    expect(() =>
      assertMarkdownPdfRendererCapabilities({
        assessment,
        requests: [
          {
            capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
            requestedBy: ["pageNumbers.start"],
          },
        ],
      }),
    ).toThrow(CliError);
    try {
      assertMarkdownPdfRendererCapabilities({
        assessment,
        requests: [
          {
            capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
            requestedBy: ["pageNumbers.start"],
          },
        ],
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnsupported,
        exitCode: 2,
      });
    }
    expect(() => assertMarkdownPdfRendererCapabilities({ assessment, requests: [] })).not.toThrow();
  });

  test("reports each unavailable capability's own minimum version", () => {
    const assessment = assessMarkdownPdfRendererCapabilities({
      renderer: rendererStatus({ version: "65.0" }),
    });
    assessment.capabilities[0] = {
      ...assessment.capabilities[0]!,
      minimumVersion: "65.2",
    };
    assessment.capabilities[1] = {
      ...assessment.capabilities[1]!,
      minimumVersion: "66.0",
    };

    expect(() =>
      assertMarkdownPdfRendererCapabilities({
        assessment,
        requests: [
          {
            capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberStart,
            requestedBy: ["pageNumbers.start"],
          },
          {
            capabilityId: MARKDOWN_PDF_RENDERER_CAPABILITY_IDS.pageNumberIncrement,
            requestedBy: ["pageNumbers.increment"],
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          /pageNumbers\.start.*minimum 65\.2.*pageNumbers\.increment.*minimum 66\.0/u,
        ),
      }),
    );
  });

  test("fails an unknown requested capability with the stable unknown ID", () => {
    const assessment = assessMarkdownPdfRendererCapabilities({
      renderer: rendererStatus({ version: "65.1" }),
    });

    expect(() =>
      assertMarkdownPdfRendererCapabilities({
        assessment,
        requests: [
          {
            capabilityId: "pageNumbers.future" as MarkdownPdfRendererCapabilityId,
            requestedBy: ["pageNumbers.start"],
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        code: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.rendererCapabilityUnknown,
        message: expect.stringContaining("minimum unknown"),
      }),
    );
  });
});

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
