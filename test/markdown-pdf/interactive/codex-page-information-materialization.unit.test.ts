import { describe, expect, test } from "bun:test";

import {
  applyMarkdownPdfCodexPageInformation,
  MarkdownPdfPageInformationConflictError,
} from "../../../src/cli/markdown-pdf/profile-codex";
import { DEFAULT_MARKDOWN_PDF_PROFILE } from "../../../src/cli/markdown-pdf/profile";
import type { MarkdownPdfCodexPageInformationSignal } from "../../../src/cli/markdown-pdf/profile-codex";

function profile(): Record<string, unknown> {
  return {
    ...structuredClone(DEFAULT_MARKDOWN_PDF_PROFILE),
    fonts: { pageChrome: { default: "Example Serif" } },
    header: { left: "Old header", center: "Old center", style: { fontSize: "9pt" } },
    footer: { left: "Old footer", center: "Occupied", style: { color: "#123456" } },
  };
}

const numbersOn: NonNullable<MarkdownPdfCodexPageInformationSignal["pageNumbers"]> = {
  enabled: true,
  scope: "body",
  countFrom: "body",
  start: 1,
  increment: 1,
  position: "bottom-center",
  format: " Exact {page} / {pages} ",
};

describe("Interactive Codex page-information materialization", () => {
  test("sets exact selected text and number settings while preserving styles and fonts", () => {
    const original = profile();
    const final = applyMarkdownPdfCodexPageInformation({
      profile: original,
      pageInformation: {
        pageNumbers: numbersOn,
        repeatingContent: {
          enabled: true,
          selected: ["top-left", "bottom-right"],
          text: { "top-left": " Exact {title} \n", "bottom-right": "Footer \u202e" },
        },
      },
      slotResolution: {
        position: "bottom-center",
        choice: "clear",
        conflictingText: "Occupied",
      },
    });

    expect(final.pageNumbers).toEqual(numbersOn);
    expect(final.header).toEqual({
      left: " Exact {title} \n",
      center: "",
      right: "",
      style: { fontSize: "9pt" },
    });
    expect(final.footer).toEqual({
      left: "",
      center: "",
      right: "Footer \u202e",
      style: { color: "#123456" },
    });
    expect(final.fonts).toEqual({ pageChrome: { default: "Example Serif" } });
    expect((original.footer as Record<string, string>).center).toBe("Occupied");
  });

  test("OFF clears every text slot and keeps valid inert number details and styles", () => {
    const original = profile();
    const final = applyMarkdownPdfCodexPageInformation({
      profile: original,
      pageInformation: {
        pageNumbers: { enabled: false },
        repeatingContent: { enabled: false },
      },
    });
    expect(final.pageNumbers).toMatchObject({ enabled: false, position: "bottom-center" });
    expect(final.header).toEqual({
      left: "",
      center: "",
      right: "",
      style: { fontSize: "9pt" },
    });
    expect(final.footer).toEqual({
      left: "",
      center: "",
      right: "",
      style: { color: "#123456" },
    });
    expect(final.fonts).toEqual(original.fonts);
  });

  test("an unspecified group preserves candidate values", () => {
    const original = profile();
    expect(applyMarkdownPdfCodexPageInformation({ profile: original })).toBe(original);
    const final = applyMarkdownPdfCodexPageInformation({
      profile: original,
      pageInformation: { pageNumbers: { enabled: false } },
    });
    expect(final.header).toBe(original.header);
    expect(final.footer).toBe(original.footer);
  });

  test("requires a resolution bound to the candidate slot and exact text", () => {
    const original = profile();
    const apply = (conflictingText?: string, choice: "clear" | "retain" = "clear") =>
      applyMarkdownPdfCodexPageInformation({
        profile: original,
        pageInformation: { pageNumbers: numbersOn },
        ...(conflictingText
          ? { slotResolution: { position: "bottom-center" as const, choice, conflictingText } }
          : {}),
      });

    expect(() => apply()).toThrow(MarkdownPdfPageInformationConflictError);
    expect(() => apply("Changed")).toThrow(MarkdownPdfPageInformationConflictError);
    expect((apply("Occupied").footer as Record<string, string>).center).toBe("");
    expect((apply("Occupied", "retain").footer as Record<string, string>).center).toBe("Occupied");
  });

  for (const repeatingOn of [false, true]) {
    test(`retains reviewed text when the candidate slot is empty (repeating ON: ${repeatingOn})`, () => {
      const candidate = profile();
      candidate.footer = { center: "" };
      const final = applyMarkdownPdfCodexPageInformation({
        profile: candidate,
        baseProfile: { footer: { center: "Reviewed base text" } },
        pageInformation: {
          pageNumbers: numbersOn,
          ...(repeatingOn
            ? {
                repeatingContent: {
                  enabled: true as const,
                  selected: ["top-left" as const],
                  text: { "top-left": "Exact header" },
                },
              }
            : {}),
        },
        slotResolution: {
          position: "bottom-center",
          choice: "retain",
          conflictingText: "Reviewed base text",
        },
      });
      expect(final.footer).toMatchObject({ center: "Reviewed base text" });
      if (repeatingOn) expect(final.header).toMatchObject({ left: "Exact header" });
    });
  }

  test("does not resurrect retained text after its base slot is cleared", () => {
    const candidate = profile();
    candidate.footer = { center: "" };
    const final = applyMarkdownPdfCodexPageInformation({
      profile: candidate,
      baseProfile: { footer: { center: "" } },
      pageInformation: { pageNumbers: numbersOn },
      slotResolution: {
        position: "bottom-center",
        choice: "retain",
        conflictingText: "Reviewed base text",
      },
    });
    expect(final.footer).toMatchObject({ center: "" });
  });

  test("requires a new decision when the base slot changes despite an empty candidate slot", () => {
    const candidate = profile();
    candidate.footer = { center: "" };
    expect(() =>
      applyMarkdownPdfCodexPageInformation({
        profile: candidate,
        baseProfile: { footer: { center: "Changed base text" } },
        pageInformation: { pageNumbers: numbersOn },
        slotResolution: {
          position: "bottom-center",
          choice: "retain",
          conflictingText: "Reviewed base text",
        },
      }),
    ).toThrow(MarkdownPdfPageInformationConflictError);
  });

  test("does not allow model-selected numbering to hide explicit repeating text", () => {
    const original = profile();
    original.pageNumbers = { ...numbersOn, position: "top-left" };
    try {
      applyMarkdownPdfCodexPageInformation({
        profile: original,
        pageInformation: {
          repeatingContent: {
            enabled: true,
            selected: ["top-left"],
            text: { "top-left": "Exact explicit text" },
          },
        },
      });
      throw new Error("Expected a conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(MarkdownPdfPageInformationConflictError);
      expect(error).toMatchObject({
        position: "top-left",
        text: "Exact explicit text",
        source: "explicit",
      });
    }
  });
});
