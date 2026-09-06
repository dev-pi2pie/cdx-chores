import { describe, expect, test } from "bun:test";
import { createMdPdfTemplateCodexBundleId } from "../../../../src/cli/markdown-pdf/template-codex";

describe("cli action modules: md pdf-template codex output paths", () => {
  test("generates readable template bundle IDs", () => {
    expect(
      createMdPdfTemplateCodexBundleId(new Date("2026-06-23T01:02:03.000Z"), 0, () => {
        return "md-pdf-template-20260623T010203Z-fixed001";
      }),
    ).toBe("md-pdf-template-20260623T010203Z-fixed001");
    expect(createMdPdfTemplateCodexBundleId(new Date("2026-06-23T01:02:03.000Z"), 0)).toMatch(
      /^md-pdf-template-20260623T010203Z-[0-9a-f]{8}$/,
    );
  });
});
