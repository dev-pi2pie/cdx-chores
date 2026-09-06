import { describe, expect, test } from "bun:test";

import type { CommandStatus } from "../../../src/cli/deps";
import { CliError } from "../../../src/cli/errors";
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
} from "../../../src/cli/markdown-pdf";
import type {
  MarkdownPdfRendererCapabilityId,
  MarkdownPdfRendererCapabilityStatus,
  NormalizedMarkdownPdfProfile,
} from "../../../src/cli/markdown-pdf";
import {
  markdownPdfProfileRendererCapabilities,
  markdownPdfProfileRendererCapabilityFields,
} from "../../../src/cli/markdown-pdf/profile";

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
