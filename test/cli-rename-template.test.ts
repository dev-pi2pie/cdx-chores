import { describe, expect, test } from "bun:test";

import {
  normalizeSerialPlaceholderInTemplate,
  parseSerialToken,
  resolveRenamePatternTemplate,
  serializeSerialToken,
  templateContainsPrefixPlaceholder,
  templateContainsSerialPlaceholder,
} from "../src/cli/rename-template";

describe("rename template contracts", () => {
  test("parses serial token parameters in order-insensitive form", () => {
    const parsed = parseSerialToken("{serial_start_2_##_order_mtime_asc}");
    expect(parsed).toEqual({
      width: 2,
      start: 2,
      order: "mtime_asc",
    });

    const parsedReordered = parseSerialToken("{serial_order_path_desc_start_7_#####}");
    expect(parsedReordered).toEqual({
      width: 5,
      start: 7,
      order: "path_desc",
    });
  });

  test("serializes token in canonical marker order", () => {
    expect(
      serializeSerialToken({
        width: 3,
        start: 0,
        order: "mtime_desc",
      }),
    ).toBe("{serial_###_start_0_order_mtime_desc}");
  });

  test("normalizes serial placeholder in templates", () => {
    const template = normalizeSerialPlaceholderInTemplate({
      template: "{timestamp}-{stem}-{serial_order_path_desc_start_2_##}",
      serial: {
        width: 4,
        start: 9,
        order: "mtime_asc",
      },
    });
    expect(template).toBe("{timestamp}-{stem}-{serial_####_start_9_order_mtime_asc}");
  });

  test("resolves preset and custom templates", () => {
    expect(resolveRenamePatternTemplate({ preset: "default" })).toBe("{prefix}-{timestamp}-{stem}");
    expect(
      resolveRenamePatternTemplate({
        preset: "custom",
        customTemplate: "{date}-{stem}-{serial}",
      }),
    ).toBe("{date}-{stem}-{serial}");
  });

  test("rejects duplicate/unknown serial parameters", () => {
    expect(() => parseSerialToken("{serial_start_1_start_2}")).toThrow(
      "Serial token cannot contain multiple start markers.",
    );
    expect(() => parseSerialToken("{serial_order_time_asc}")).toThrow(
      "Serial order marker must use one of: path_asc, path_desc, mtime_asc, mtime_desc.",
    );
    expect(() => parseSerialToken("{serial_badparam}")).toThrow(
      "Unknown serial token parameter 'badparam'.",
    );
  });

  test("detects whether template uses serial placeholder", () => {
    expect(templateContainsSerialPlaceholder("{date}-{stem}")).toBe(false);
    expect(templateContainsSerialPlaceholder("{date}-{stem}-{serial}")).toBe(true);
    expect(templateContainsSerialPlaceholder("{serial_###_start_2_order_mtime_asc}-{stem}")).toBe(true);
  });

  test("detects whether template uses prefix placeholder", () => {
    expect(templateContainsPrefixPlaceholder("{date}-{stem}")).toBe(false);
    expect(templateContainsPrefixPlaceholder("{prefix}-{timestamp}-{stem}")).toBe(true);
  });
});
