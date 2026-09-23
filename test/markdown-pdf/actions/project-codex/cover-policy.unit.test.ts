import { describe, expect, test } from "bun:test";

import {
  applyMdPdfProjectCoverPolicy,
  assertMdPdfProjectKnownCoverCompatibility,
  classifyMdPdfProjectCoverIntent,
  explicitMdPdfProjectBaseCoverChoice,
} from "../../../../src/cli/markdown-pdf/project-codex/cover-policy";

describe("Project cover policy", () => {
  test("distinguishes an explicit base cover choice from an omitted default", () => {
    expect(explicitMdPdfProjectBaseCoverChoice({})).toBeUndefined();
    expect(explicitMdPdfProjectBaseCoverChoice({ cover: { style: "report" } })).toBeUndefined();
    expect(explicitMdPdfProjectBaseCoverChoice({ cover: { enabled: false } })).toBe(false);
    expect(explicitMdPdfProjectBaseCoverChoice({ cover: { enabled: true } })).toBe(true);
  });

  test.each([
    [undefined, "none"],
    ["Use a restrained report layout", "none"],
    ["Add a cover page", "generic"],
    ["Use a text-only cover", "text-only"],
    ["No cover image, use a text-only cover", "text-only"],
    ["Use a text cover without a photo", "text-only"],
    ["Use an image cover", "image"],
    ["Skip the cover page", "no-cover"],
    ["Skip the cover page in page numbering", "none"],
    ["No page numbers on the cover page", "none"],
    ["Do not number the cover page", "none"],
    ["Start page numbering after the cover", "none"],
    ["Use a text-only cover and an image cover", "conflict"],
  ] as const)("classifies explicit intent %p", (intent, expected) => {
    expect(classifyMdPdfProjectCoverIntent(intent)).toBe(expected);
  });

  test("rejects a selected image with a base Profile cover OFF before preparation", () => {
    expect(() =>
      assertMdPdfProjectKnownCoverCompatibility({
        coverImageAvailable: true,
        baseProfileCoverEnabled: false,
      }),
    ).toThrow("conflicts with the base Profile");
  });

  test.each([
    { image: true, base: undefined, intent: undefined, expected: true },
    { image: false, base: undefined, intent: "Add a cover", expected: true },
    { image: false, base: true, intent: undefined, expected: true },
    { image: false, base: undefined, intent: undefined, expected: false },
    { image: false, base: false, intent: undefined, expected: false },
    { image: false, base: undefined, intent: "No cover", expected: false },
  ])("materializes the cover result for $intent, image=$image, base=$base", (row) => {
    const profile = {
      cover: {
        enabled: !row.expected,
        style: "report",
        fields: { title: "{title}", subtitle: "A subtitle" },
      },
    };
    const result = applyMdPdfProjectCoverPolicy({
      baseProfileCoverEnabled: row.base,
      coverImageAvailable: row.image,
      finalProfile: profile,
      intent: row.intent,
    });
    expect((result.cover as { enabled: boolean }).enabled).toBe(row.expected);
    expect((result.cover as { fields: { subtitle: string } }).fields.subtitle).toBe("A subtitle");
    expect(profile.cover.enabled).toBe(!row.expected);
  });

  test.each([
    { image: true, base: undefined, intent: "Use a text-only cover" },
    { image: true, base: undefined, intent: "No cover" },
    { image: true, base: undefined, intent: "No cover image" },
    { image: false, base: undefined, intent: "Use an image cover" },
    { image: false, base: false, intent: "Add a cover" },
    { image: false, base: true, intent: "No cover" },
  ])("rejects conflicting choices for $intent", (row) => {
    expect(() =>
      applyMdPdfProjectCoverPolicy({
        baseProfileCoverEnabled: row.base,
        coverImageAvailable: row.image,
        finalProfile: {},
        intent: row.intent,
      }),
    ).toThrow("conflict");
  });
});
