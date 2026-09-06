import { describe, expect, test } from "bun:test";

import {
  collectMarkdownPdfProfileAuthoringReview,
  formatMarkdownPdfProfileAuthoringReview,
  type MarkdownPdfProfileAuthoringCapabilityRequirement,
} from "../../../src/cli/markdown-pdf/profile-authoring-review";

describe("Markdown PDF shared Profile authoring review", () => {
  test("normalizes a sparse raw Profile into bounded advisory review data", () => {
    const review = collectMarkdownPdfProfileAuthoringReview({
      pageNumbers: { enabled: true, start: 0 },
    });

    expect(review.normalizedProfile.pageNumbers).toEqual({
      enabled: true,
      scope: "body",
      countFrom: "document",
      start: 0,
      increment: 1,
      position: "bottom-center",
      format: "{page}",
    });
    expect(review.normalizedProfile.header).toEqual({ left: "", center: "", right: "" });
    expect(review.normalizedProfile.footer).toEqual({ left: "", center: "", right: "" });
    expect(review.capabilityRequirements).toEqual([
      {
        capabilityId: "pageNumbers.start",
        requestedBy: ["pageNumbers.start"],
        minimumVersion: "65.1",
      },
    ]);
    expect(Object.keys(review.capabilityRequirements[0] ?? {}).sort()).toEqual([
      "capabilityId",
      "minimumVersion",
      "requestedBy",
    ]);

    const publicReview = JSON.stringify({
      review,
      lines: formatMarkdownPdfProfileAuthoringReview(review),
    });
    expect(publicReview).not.toMatch(
      /installed|probe|readiness|conditionId|diagnosticConditionId|status/i,
    );
  });

  test("escapes terminal controls in every free-form displayed value", () => {
    const escape = "\u001B";
    const bell = "\u0007";
    const review = collectMarkdownPdfProfileAuthoringReview({
      pageNumbers: {
        enabled: true,
        format: `Page ${escape}]8;;https://example.invalid${bell}link${escape}]8;;${bell} {page}`,
      },
      header: {
        left: `${escape}[31mred${escape}[0m`,
        center: `${escape}]0;title${bell}`,
        right: "safe",
      },
    });
    const formatted = formatMarkdownPdfProfileAuthoringReview(review).join("\n");

    expect(formatted).not.toContain(escape);
    expect(formatted).not.toContain(bell);
    expect(formatted).toContain('Label: "Page \\u001b]8;;https://example.invalid\\u0007');
    expect(formatted).toContain('left="\\u001b[31mred\\u001b[0m"');
    expect(formatted).toContain('center="\\u001b]0;title\\u0007"');
  });

  test("summarizes disabled page numbering without presenting inert sequence details", () => {
    const lines = formatMarkdownPdfProfileAuthoringReview(
      collectMarkdownPdfProfileAuthoringReview({
        pageNumbers: {
          enabled: false,
          scope: "document",
          countFrom: "document",
          start: 7,
          increment: 2,
          position: "top-right",
          format: "Page {page} of {pages}",
        },
      }),
    );

    expect(lines).toContain("Reusable Profile page numbering:");
    expect(lines).toContain("- Enabled: no");
    expect(lines).toContain("Reusable Profile repeating page content:");
    expect(lines).not.toContain("- Scope: document");
    expect(lines).not.toContain("- Start: 7");
    expect(lines).not.toContain("- Position: top-right");
    expect(lines).not.toContain('- Label: "Page {page} of {pages}"');
  });

  test("aggregates every capability in matrix order across header and footer", () => {
    const pageChrome = {
      header: {
        left: "Header",
        center: "",
        right: "",
        style: {
          fontSize: "8pt",
          fontWeight: 500,
          lineHeight: 1.1,
          color: "#112233",
          separator: {
            width: "0.5pt",
            style: "solid",
            color: "#445566",
            gap: "1mm",
          },
        },
      },
      footer: {
        left: "Footer",
        center: "",
        right: "",
        style: {
          fontSize: "9pt",
          fontWeight: 600,
          lineHeight: 1.2,
          color: "#223344",
          separator: {
            width: "1pt",
            style: "solid",
            color: "#556677",
            gap: 0,
          },
        },
      },
    } as const;
    const bodyOrigin = collectMarkdownPdfProfileAuthoringReview({
      ...pageChrome,
      pageNumbers: {
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
      },
    }).capabilityRequirements;
    const documentScope = collectMarkdownPdfProfileAuthoringReview({
      ...pageChrome,
      pageNumbers: {
        enabled: true,
        scope: "document",
        countFrom: "document",
        start: 0,
        increment: 2,
      },
    }).capabilityRequirements;

    const sharedStyleRequirements: MarkdownPdfProfileAuthoringCapabilityRequirement[] = [
      {
        capabilityId: "pageChrome.fontSize",
        requestedBy: ["header.style.fontSize", "footer.style.fontSize"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.fontWeight",
        requestedBy: ["header.style.fontWeight", "footer.style.fontWeight"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.lineHeight",
        requestedBy: ["header.style.lineHeight", "footer.style.lineHeight"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.color",
        requestedBy: ["header.style.color", "footer.style.color"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.separator.width",
        requestedBy: ["header.style.separator.width", "footer.style.separator.width"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.separator.style",
        requestedBy: ["header.style.separator.style", "footer.style.separator.style"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.separator.color",
        requestedBy: ["header.style.separator.color", "footer.style.separator.color"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageChrome.separator.gap",
        requestedBy: ["header.style.separator.gap", "footer.style.separator.gap"],
        minimumVersion: "65.1",
      },
    ];
    expect(bodyOrigin).toEqual([
      {
        capabilityId: "pageNumbers.start",
        requestedBy: ["pageNumbers.start"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageNumbers.increment",
        requestedBy: ["pageNumbers.increment"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageNumbers.countFrom.body",
        requestedBy: ["pageNumbers.countFrom"],
        minimumVersion: "65.1",
      },
      ...sharedStyleRequirements,
    ]);
    expect(documentScope).toEqual([
      {
        capabilityId: "pageNumbers.start",
        requestedBy: ["pageNumbers.start"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageNumbers.increment",
        requestedBy: ["pageNumbers.increment"],
        minimumVersion: "65.1",
      },
      {
        capabilityId: "pageNumbers.scope.document",
        requestedBy: ["pageNumbers.scope"],
        minimumVersion: "65.1",
      },
      ...sharedStyleRequirements,
    ]);

    const allRequirements = [...bodyOrigin, ...documentScope];
    expect([...new Set(allRequirements.map(({ capabilityId }) => capabilityId))]).toEqual([
      "pageNumbers.start",
      "pageNumbers.increment",
      "pageNumbers.countFrom.body",
      "pageChrome.fontSize",
      "pageChrome.fontWeight",
      "pageChrome.lineHeight",
      "pageChrome.color",
      "pageChrome.separator.width",
      "pageChrome.separator.style",
      "pageChrome.separator.color",
      "pageChrome.separator.gap",
      "pageNumbers.scope.document",
    ]);
    for (const requirement of allRequirements) {
      expect(Object.keys(requirement).sort()).toEqual([
        "capabilityId",
        "minimumVersion",
        "requestedBy",
      ]);
    }
  });
});
