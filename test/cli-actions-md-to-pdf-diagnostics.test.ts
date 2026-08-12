import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf, prepareMarkdownPdfRender } from "../src/cli/actions";
import {
  collectMarkdownPdfDiagnostics,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING,
} from "../src/cli/markdown-pdf";
import type {
  MarkdownPdfTemplateCompatibilityResult,
  NormalizedMarkdownPdfPageNumbers,
  NormalizedMarkdownPdfProfile,
} from "../src/cli/markdown-pdf";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function profileWith(input: {
  footerCenter?: string;
  pageNumbers?: Partial<NormalizedMarkdownPdfPageNumbers>;
}): NormalizedMarkdownPdfProfile {
  return {
    ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
    footer: {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.footer,
      center: input.footerCenter ?? "",
    },
    pageNumbers: {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
      enabled: true,
      ...input.pageNumbers,
    },
  };
}

const PROVEN_TEMPLATE: MarkdownPdfTemplateCompatibilityResult = {
  bodyBoundary: "proven",
};

describe("Markdown PDF structured diagnostics", () => {
  test("collects stable conditions once in deterministic order", () => {
    const profile = profileWith({
      footerCenter: "Existing footer",
      pageNumbers: {
        countFrom: "body",
        format: "Page {page} of {pages}",
        increment: 2,
        position: "bottom-center",
        start: 0,
      },
    });
    const templateCompatibility: MarkdownPdfTemplateCompatibilityResult = {
      bodyBoundary: "legacy-document-origin-fallback",
    };

    const diagnostics = collectMarkdownPdfDiagnostics({
      profile,
      pageNumbers: profile.pageNumbers,
      templateCompatibility,
    });

    expect(diagnostics.conditions.map(({ conditionId }) => conditionId)).toEqual([
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.physicalPageTotalWithLogicalSequence,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyBodyVisibilityFallback,
    ]);
    expect(new Set(diagnostics.conditions.map(({ conditionId }) => conditionId))).toHaveLength(3);
    expect(diagnostics.conditions[0]).toMatchObject({
      severity: "warning",
      context: {
        kind: "occupied-page-number-slot",
        area: "footer",
        slot: "center",
        position: "bottom-center",
      },
    });
    expect(diagnostics.conditions[1]).toMatchObject({
      context: {
        kind: "physical-page-total-with-logical-sequence",
        countFrom: "body",
        start: 0,
        increment: 2,
      },
    });
    expect(diagnostics.conditions[2]?.message).toBe(MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING);

    expect(
      collectMarkdownPdfDiagnostics({
        profile,
        pageNumbers: profile.pageNumbers,
        templateCompatibility,
      }),
    ).toEqual(diagnostics);
  });

  test("uses configured trim semantics for occupied slots", () => {
    for (const [configured, occupied] of [
      ["  ", false],
      ["{missing}", true],
      [" Existing footer ", true],
    ] as const) {
      const profile = profileWith({ footerCenter: configured });
      const diagnostics = collectMarkdownPdfDiagnostics({
        profile,
        pageNumbers: profile.pageNumbers,
        templateCompatibility: PROVEN_TEMPLATE,
      });
      expect(
        diagnostics.conditions.some(
          ({ conditionId }) =>
            conditionId === MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
        ),
      ).toBe(occupied);
    }
  });

  test.each([
    ["top-left", "header", "left"],
    ["top-center", "header", "center"],
    ["top-right", "header", "right"],
    ["bottom-left", "footer", "left"],
    ["bottom-center", "footer", "center"],
    ["bottom-right", "footer", "right"],
  ] as const)("maps occupied %s to %s.%s", (position, area, slot) => {
    const profile = profileWith({ pageNumbers: { position } });
    profile[area][slot] = "Occupied";

    const diagnostics = collectMarkdownPdfDiagnostics({
      profile,
      pageNumbers: profile.pageNumbers,
      templateCompatibility: PROVEN_TEMPLATE,
    });

    expect(diagnostics.conditions).toEqual([
      expect.objectContaining({
        conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
        context: {
          kind: "occupied-page-number-slot",
          area,
          slot,
          position,
        },
      }),
    ]);
  });

  test("warns for physical pages only when logical sequence controls change", () => {
    const cases = [
      [{ format: "{page} / {pages}" }, false],
      [{ format: "{page} / {pages}", start: 0 }, true],
      [{ format: "{page} / {pages}", increment: 2 }, true],
      [{ format: "{page} / {pages}", countFrom: "body" as const }, true],
      [{ format: "{page}", start: 0, increment: 2 }, false],
    ] as const;

    for (const [pageNumbers, expected] of cases) {
      const profile = profileWith({ pageNumbers });
      const diagnostics = collectMarkdownPdfDiagnostics({
        profile,
        pageNumbers: profile.pageNumbers,
        templateCompatibility: PROVEN_TEMPLATE,
      });
      expect(
        diagnostics.conditions.some(
          ({ conditionId }) =>
            conditionId ===
            MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.physicalPageTotalWithLogicalSequence,
        ),
      ).toBe(expected);
    }
  });

  test("suppresses every page-number condition when effective numbering is disabled", () => {
    const profile = profileWith({
      footerCenter: "Existing footer",
      pageNumbers: { countFrom: "body", format: "{pages}", start: 0 },
    });

    expect(
      collectMarkdownPdfDiagnostics({
        profile,
        pageNumbers: { ...profile.pageNumbers, enabled: false },
        templateCompatibility: { bodyBoundary: "legacy-document-origin-fallback" },
      }),
    ).toEqual({ conditions: [] });
  });

  test("uses the direct effective disable during preparation", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-effective-disable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "footer:",
          "  center: Existing footer",
          "pageNumbers:",
          "  enabled: true",
          '  format: "{pages}"',
          "  start: 0",
          "",
        ].join("\n"),
        "utf8",
      );
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        pageNumbers: false,
      });

      expect(prepared.normalizedProfile.pageNumbers.enabled).toBeTrue();
      expect(prepared.pageNumberConfiguration.effective.enabled).toBeFalse();
      expect(prepared.diagnostics).toEqual({ conditions: [] });
    });
  });

  test("prints each structured warning once while preserving successful rendering", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "footer:",
          "  center: Existing footer",
          "pageNumbers:",
          "  enabled: true",
          '  format: "Page {page} of {pages}"',
          "  increment: 2",
          "",
        ].join("\n"),
        "utf8",
      );
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stdout, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        runner,
      });

      expect(stdout.text).toContain("Wrote PDF:");
      expect(stderr.text.match(/replace configured footer\.center content/g)).toHaveLength(1);
      expect(stderr.text.match(/physical PDF page count/g)).toHaveLength(1);
    });
  });

  test("resets structured diagnostics between sequential renders", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-sequential", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "first.md");
      const secondInputPath = join(fixtureDir, "second.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(firstInputPath, "# First\n", "utf8");
      await writeFile(secondInputPath, "# Second\n", "utf8");
      await writeFile(
        profilePath,
        ["footer:", "  center: Existing footer", "pageNumbers:", "  enabled: true", ""].join("\n"),
        "utf8",
      );
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(firstInputPath),
        profile: toRepoRelativePath(profilePath),
        output: toRepoRelativePath(join(fixtureDir, "first.pdf")),
        runner,
      });
      const firstRenderStderr = stderr.text;
      expect(firstRenderStderr.match(/replace configured footer\.center content/g)).toHaveLength(1);

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(secondInputPath),
        output: toRepoRelativePath(join(fixtureDir, "second.pdf")),
        runner,
      });

      expect(stderr.text).toBe(firstRenderStderr);
    });
  });
});
