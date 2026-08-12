import { describe, expect, test } from "bun:test";

import {
  collectMarkdownPdfProfileAuthoringReview,
  formatMarkdownPdfProfileAuthoringReview,
} from "../src/cli/markdown-pdf/profile-authoring-review";

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
});
