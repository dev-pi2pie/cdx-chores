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
    ["Report with a text cover", "text-only"],
    ["Leave the cover out", "ambiguous"],
    ["Leave the text-only cover out", "ambiguous"],
    ["A cover is unnecessary", "ambiguous"],
    ["I don't want to add a cover", "ambiguous"],
    ["Only add a cover if requested later", "ambiguous"],
    ["Use a text-only cover", "text-only"],
    ["No cover image, use a text-only cover", "text-only"],
    ["Use a text cover without a photo", "text-only"],
    ["Do not use a cover image, use a text cover", "text-only"],
    ["Use an image cover", "image"],
    ["Skip the cover page", "no-cover"],
    ["Do not include a cover page", "no-cover"],
    ["Don't add a cover", "no-cover"],
    ["Do not add a text-only cover", "no-cover"],
    ["No text cover", "no-cover"],
    ["Without a text only cover page", "no-cover"],
    ["Skip the textual cover", "no-cover"],
    ["Never create a typographic title page", "no-cover"],
    ["Don't use a cover with text only", "no-cover"],
    ["No text-only cover and no textual title-page", "no-cover"],
    ["Do not add a text-only cover, but add a text cover", "conflict"],
    ["No cover, but add a cover page", "conflict"],
    ["Do not use a cover image", "none"],
    ["Skip the cover page in page numbering", "none"],
    ["No page numbers on the cover page", "none"],
    ["Do not number the cover page", "none"],
    ["Keep page numbers off the cover", "none"],
    ["Don't put page numbers on the cover", "none"],
    ["Keep page numbers off the cover, but add a cover page", "generic"],
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

  test.each([true, false])(
    "preserves the validated cover decision %s for ambiguous prose",
    (enabled) => {
      for (const intent of [
        "Leave the cover out",
        "Leave the text-only cover out",
        "A cover is unnecessary",
        "I don't want to add a cover",
        "Only add a cover if requested later",
      ]) {
        const profile = { cover: { enabled, style: "plain", fields: { title: "{title}" } } };
        expect(
          applyMdPdfProjectCoverPolicy({
            coverImageAvailable: false,
            finalProfile: profile,
            intent,
          }),
        ).toBe(profile);
      }
    },
  );

  test.each([true, false])("retains explicit base cover %s under ambiguous prose", (enabled) => {
    const result = applyMdPdfProjectCoverPolicy({
      baseProfileCoverEnabled: enabled,
      coverImageAvailable: false,
      finalProfile: { cover: { enabled: !enabled } },
      intent: "Cover placement details",
    });
    expect(result.cover).toMatchObject({ enabled });
  });

  test("retains a selected image under ambiguous prose", () => {
    expect(
      applyMdPdfProjectCoverPolicy({
        coverImageAvailable: true,
        finalProfile: { cover: { enabled: false } },
        intent: "Cover placement details",
      }).cover,
    ).toMatchObject({ enabled: true });
  });

  test.each([
    { image: true, base: undefined, intent: undefined, expected: true },
    { image: false, base: undefined, intent: "Add a cover", expected: true },
    { image: false, base: true, intent: undefined, expected: true },
    { image: false, base: undefined, intent: undefined, expected: false },
    { image: false, base: false, intent: undefined, expected: false },
    { image: false, base: undefined, intent: "No cover", expected: false },
    { image: false, base: undefined, intent: "Do not add a text-only cover", expected: false },
    { image: false, base: false, intent: "No text cover", expected: false },
    { image: false, base: undefined, intent: "Do not include a cover page", expected: false },
    { image: false, base: undefined, intent: "Do not use a cover image", expected: false },
    { image: false, base: true, intent: "Do not use a cover image", expected: true },
    { image: false, base: undefined, intent: "Keep page numbers off the cover", expected: false },
    {
      image: false,
      base: undefined,
      intent: "Don't put page numbers on the cover",
      expected: false,
    },
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
    { image: true, base: undefined, intent: "Do not use a cover image" },
    { image: false, base: undefined, intent: "Use an image cover" },
    { image: false, base: false, intent: "Add a cover" },
    { image: false, base: true, intent: "No cover" },
    { image: false, base: true, intent: "No text cover" },
    { image: true, base: undefined, intent: "Do not add a text-only cover" },
    { image: false, base: undefined, intent: "No text cover, but add a text-only cover" },
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

describe("Project structured cover intent", () => {
  test.each(["請加入文字封面", "表紙を追加してください", "Add a titlepage"])(
    "honors the interpreted request for %s",
    (intent) => {
      expect(
        applyMdPdfProjectCoverPolicy({
          intent,
          modelCoverIntent: "text-only",
          coverImageAvailable: false,
          finalProfile: { cover: { enabled: true } },
        }).cover,
      ).toMatchObject({ enabled: true });
    },
  );
  test.each(["Use readable typography", "Start page numbering after the cover"])(
    "does not infer a cover from the model profile for %s",
    (intent) => {
      expect(
        applyMdPdfProjectCoverPolicy({
          intent,
          modelCoverIntent: "unspecified",
          coverImageAvailable: false,
          finalProfile: { cover: { enabled: true } },
        }).cover,
      ).toMatchObject({ enabled: false });
    },
  );
  test("ignores a model request when advisory intent is absent", () => {
    expect(
      applyMdPdfProjectCoverPolicy({
        modelCoverIntent: "requested",
        coverImageAvailable: false,
        finalProfile: { cover: { enabled: true } },
      }).cover,
    ).toMatchObject({ enabled: false });
  });
  test.each([
    { intent: "請不要加入封面", modelCoverIntent: "no-cover" as const, coverImageAvailable: true },
    { intent: "請加入圖片封面", modelCoverIntent: "image" as const, coverImageAvailable: false },
    { intent: "請加入文字封面", modelCoverIntent: "text-only" as const, coverImageAvailable: true },
    {
      intent: "請加入文字封面",
      modelCoverIntent: "text-only" as const,
      coverImageAvailable: false,
      baseProfileCoverEnabled: false,
    },
    {
      intent: "請不要加入封面",
      modelCoverIntent: "no-cover" as const,
      coverImageAvailable: false,
      baseProfileCoverEnabled: true,
    },
  ])("rejects interpreted constraints for $intent", (row) => {
    expect(() => applyMdPdfProjectCoverPolicy({ ...row, finalProfile: {} })).toThrow("conflict");
  });
});
