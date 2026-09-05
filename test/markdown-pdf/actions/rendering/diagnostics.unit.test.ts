import { describe, expect, test } from "bun:test";

import {
  assessMarkdownPdfCoverVisibility,
  assessMarkdownPdfProfileRevision,
  collectMarkdownPdfEmptyCoverDiagnostic,
  collectMarkdownPdfDiagnostics,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_EMPTY_COVER_WARNING,
  MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING,
} from "../../../../src/cli/markdown-pdf";
import type {
  MarkdownPdfTemplateCompatibilityResult,
  NormalizedMarkdownPdfPageNumbers,
  NormalizedMarkdownPdfProfile,
} from "../../../../src/cli/markdown-pdf";

function profileWith(input: {
  footerCenter?: string;
  pageNumbers?: Partial<NormalizedMarkdownPdfPageNumbers>;
}): NormalizedMarkdownPdfProfile {
  return {
    ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
    header: { ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.header },
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
    const profileRevision = assessMarkdownPdfProfileRevision({
      schemaVersion: 2,
      pageNumbers: { countFrom: "body", start: 0 },
    });

    const diagnostics = collectMarkdownPdfDiagnostics({
      profile,
      pageNumbers: profile.pageNumbers,
      profileRevision,
      templateCompatibility,
    });

    expect(diagnostics.conditions.map(({ conditionId }) => conditionId)).toEqual([
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionStale,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyPagesTokenMigration,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyBodyVisibilityFallback,
    ]);
    expect(new Set(diagnostics.conditions.map(({ conditionId }) => conditionId))).toHaveLength(4);
    expect(diagnostics.conditions[1]).toMatchObject({
      severity: "warning",
      context: {
        kind: "occupied-page-number-slot",
        area: "footer",
        slot: "center",
        position: "bottom-center",
      },
    });
    expect(diagnostics.conditions[2]).toMatchObject({
      context: {
        kind: "legacy-pages-token-migration",
        countFrom: "body",
        declaredRevision: 2,
      },
    });
    expect(diagnostics.conditions[2]?.message).toContain("countFrom: body");
    expect(diagnostics.conditions[3]?.message).toBe(MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING);
    expect(JSON.stringify(diagnostics)).not.toContain("\u001b");

    expect(
      collectMarkdownPdfDiagnostics({
        profile,
        pageNumbers: profile.pageNumbers,
        profileRevision,
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

  test("warns once only for exact legacy {pages} tokens with declared revision 1 or 2", () => {
    const cases = [
      [1, "{pages}", true],
      [2, "{pages} / {pages}", true],
      [3, "{pages}", false],
      [4, "{pages}", false],
      [undefined, "{pages}", false],
      ["2", "{pages}", false],
      [2, "{page}", false],
      [2, "{Pages}", false],
      [2, "{pagesx}", false],
      [2, "{pdfPages}", false],
    ] as const;

    for (const [schemaVersion, format, expected] of cases) {
      const profile = profileWith({ pageNumbers: { format } });
      const profileDeclaration = schemaVersion === undefined ? {} : { schemaVersion };
      const diagnostics = collectMarkdownPdfDiagnostics({
        profile,
        profileRevision: assessMarkdownPdfProfileRevision(profileDeclaration),
        pageNumbers: profile.pageNumbers,
        templateCompatibility: PROVEN_TEMPLATE,
      });
      const migrations = diagnostics.conditions.filter(
        ({ conditionId }) =>
          conditionId === MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyPagesTokenMigration,
      );
      expect(migrations.length > 0).toBe(expected);
      expect(migrations.length).toBeLessThanOrEqual(1);
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
        profileRevision: assessMarkdownPdfProfileRevision({ schemaVersion: 2 }),
        pageNumbers: { ...profile.pageNumbers, enabled: false },
        templateCompatibility: { bodyBoundary: "legacy-document-origin-fallback" },
      }),
    ).toEqual({ conditions: [] });
  });

  test("collects an empty-cover warning without requiring page numbers", () => {
    const profile: NormalizedMarkdownPdfProfile = {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
      metadata: { title: "  ", company: "Visible company" },
      cover: {
        ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.cover,
        enabled: true,
        fields: {
          title: "{title}",
          subtitle: "{missing}",
          author: "",
          company: "{missingCompany}",
          date: "   ",
        },
      },
    };

    expect(assessMarkdownPdfCoverVisibility(profile)).toEqual({
      fields: {
        title: "  ",
        subtitle: "",
        author: "",
        company: "",
        date: "   ",
      },
      hasVisibleMetadata: false,
      visibleFields: [],
    });
    const emptyCoverDiagnostic = collectMarkdownPdfEmptyCoverDiagnostic(profile);
    expect(emptyCoverDiagnostic).toEqual({
      conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverFieldsEmpty,
      severity: "warning",
      message: MARKDOWN_PDF_EMPTY_COVER_WARNING,
      context: { kind: "empty-cover-fields" },
    });
    const conditions = collectMarkdownPdfDiagnostics({
      profile,
      pageNumbers: profile.pageNumbers,
      templateCompatibility: { bodyBoundary: "not-required", coverBoundary: "built-in" },
    }).conditions;
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toEqual(emptyCoverDiagnostic);

    const noDefaultCssDiagnostics = collectMarkdownPdfDiagnostics({
      profile,
      pageNumbers: profile.pageNumbers,
      templateCompatibility: { bodyBoundary: "not-required", coverBoundary: "built-in" },
      noDefaultCss: true,
    });
    expect(noDefaultCssDiagnostics.conditions.map(({ conditionId }) => conditionId)).toEqual([
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverFieldsEmpty,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverDefaultCssDisabled,
    ]);
    expect(JSON.stringify(noDefaultCssDiagnostics)).not.toContain("\u001b");
  });
});
