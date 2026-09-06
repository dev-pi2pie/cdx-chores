import { describe, expect, test } from "bun:test";

import {
  formatMarkdownPdfPageNumberReview,
  resolveGeneratedMarkdownPdfPageNumberConfiguration,
} from "../../../src/cli/interactive/markdown/page-number-review";
import type { MarkdownPdfPageNumberReviewInput } from "../../../src/cli/interactive/markdown/page-number-review";

const EFFECTIVE_PAGE_NUMBERS = {
  enabled: false,
  scope: "document",
  countFrom: "document",
  start: 1,
  increment: 1,
  position: "bottom-center",
  format: "{page}",
} as const;

function reviewInput(
  input: Partial<MarkdownPdfPageNumberReviewInput> = {},
): MarkdownPdfPageNumberReviewInput {
  return {
    pageNumberConfiguration: {
      profileEnabled: false,
      source: "default",
      effective: EFFECTIVE_PAGE_NUMBERS,
    },
    rendererCapabilityRequests: [],
    resolvedInputs: {},
    ...input,
  };
}

describe("formatMarkdownPdfPageNumberReview", () => {
  test("shows the normalized default distinctly for a built-in recipe", () => {
    expect(formatMarkdownPdfPageNumberReview(reviewInput())).toEqual([
      "Page numbers:",
      "- Recipe setting: disabled (normalized default)",
      "- One-render override: use recipe setting",
      "- Effective result: disabled",
      "- Effective source: normalized default",
    ]);
  });

  test.each([
    {
      enabled: true,
      expected: ["- Recipe setting: enabled (reusable Profile)", "- Effective result: enabled"],
    },
    {
      enabled: false,
      expected: ["- Recipe setting: disabled (reusable Profile)", "- Effective result: disabled"],
    },
  ])("shows an enabled=$enabled reusable Profile", ({ enabled, expected }) => {
    const lines = formatMarkdownPdfPageNumberReview(
      reviewInput({
        pageNumberConfiguration: {
          profileEnabled: enabled,
          source: "profile",
          effective: { ...EFFECTIVE_PAGE_NUMBERS, enabled },
        },
        resolvedInputs: {
          profile: { path: "/example/profile.yml", source: "explicit" },
        },
      }),
    );

    expect(lines).toContain(expected[0]!);
    expect(lines).toContain("- One-render override: use recipe setting");
    expect(lines).toContain(expected[1]!);
    expect(lines).toContain("- Effective source: reusable Profile");
  });

  test.each([
    {
      override: true,
      label: "enable for this PDF",
      effective: true,
    },
    {
      override: false,
      label: "disable for this PDF",
      effective: false,
    },
  ])(
    "preserves an explicit $override override without truthiness loss",
    ({ effective, label, override }) => {
      const lines = formatMarkdownPdfPageNumberReview(
        reviewInput({
          pageNumberConfiguration: {
            profileEnabled: !effective,
            override,
            source: "direct-override",
            effective: { ...EFFECTIVE_PAGE_NUMBERS, enabled: effective },
          },
        }),
      );

      expect(lines).toContain(`- One-render override: ${label}`);
      expect(lines).toContain(`- Effective result: ${effective ? "enabled" : "disabled"}`);
      expect(lines).toContain("- Effective source: one-render override");
    },
  );

  test("keeps a direct built-in override distinct from a reusable Profile", () => {
    const lines = formatMarkdownPdfPageNumberReview(
      reviewInput({
        pageNumberConfiguration: {
          profileEnabled: false,
          override: true,
          source: "direct-override",
          effective: { ...EFFECTIVE_PAGE_NUMBERS, enabled: true },
        },
      }),
    );

    expect(lines).toContain("- Recipe setting: disabled (normalized default)");
    expect(lines).toContain("- One-render override: enable for this PDF");
    expect(lines).toContain("- Effective source: one-render override");
    expect(lines.join("\n")).not.toContain("reusable Profile");
  });

  test("formats requested requirements in canonical order without installed posture", () => {
    const lines = formatMarkdownPdfPageNumberReview(
      reviewInput({
        rendererCapabilityRequests: [
          {
            capabilityId: "pageNumbers.countFrom.body",
            requestedBy: ["pageNumbers.countFrom"],
          },
          {
            capabilityId: "pageNumbers.start",
            requestedBy: ["pageNumbers.start"],
          },
        ],
      }),
    );

    expect(lines.slice(-6)).toEqual([
      "",
      "Renderer capabilities requested by this recipe:",
      "- pageNumbers.start: minimum WeasyPrint 65.1",
      "  requested by: pageNumbers.start",
      "- pageNumbers.countFrom.body: minimum WeasyPrint 65.1",
      "  requested by: pageNumbers.countFrom",
    ]);
    const text = lines.join("\n").toLowerCase();
    expect(text).not.toContain("diagnostic");
    expect(text).not.toContain("warning");
    expect(text).not.toContain("assessment");
    expect(text).not.toContain("status");
    expect(text).not.toContain("readiness");
    expect(text).not.toContain("installed");
  });
});

describe("resolveGeneratedMarkdownPdfPageNumberConfiguration", () => {
  test("uses the normalized default for a Profile-less generated Template", () => {
    const result = resolveGeneratedMarkdownPdfPageNumberConfiguration(
      {
        kind: "deterministic",
        candidate: {
          artifact: "template-bundle",
          preparation: "starter",
          prepared: {} as never,
        },
      },
      "enable",
    );

    expect(result.profileSource).toBe(false);
    expect(result.configuration).toEqual(
      expect.objectContaining({
        profileEnabled: false,
        override: true,
        source: "direct-override",
        effective: expect.objectContaining({ enabled: true }),
      }),
    );
  });

  test("resolves the accepted generated Profile before materialization", () => {
    const result = resolveGeneratedMarkdownPdfPageNumberConfiguration(
      {
        kind: "deterministic",
        candidate: {
          artifact: "profile",
          preparation: "starter",
          prepared: { profile: { pageNumbers: { enabled: true } } } as never,
        },
      },
      "inherit",
    );

    expect(result.profileSource).toBe(true);
    expect(result.configuration.profileEnabled).toBe(true);
    expect(result.configuration.effective.enabled).toBe(true);
  });

  test("resolves a Codex Project from its final contained Profile", () => {
    const result = resolveGeneratedMarkdownPdfPageNumberConfiguration(
      {
        kind: "codex",
        candidate: {
          artifact: "project-bundle",
          prepared: {
            profilePhase: { finalProfile: { pageNumbers: { enabled: true } } },
          } as never,
          setup: { artifact: "project-bundle", fontHints: [] },
        },
      },
      "disable",
    );

    expect(result.profileSource).toBe(true);
    expect(result.configuration).toEqual(
      expect.objectContaining({
        profileEnabled: true,
        override: false,
        source: "direct-override",
        effective: expect.objectContaining({ enabled: false }),
      }),
    );
  });
});
