import { describe, expect, test } from "bun:test";

import { isValidXml } from "../../src/utils/xml-validation";

describe("XML syntax validation policy", () => {
  test("accepts ordinary XML and translates malformed syntax into false", () => {
    expect(isValidXml('<root value="A&amp;B"><child/></root>')).toBe(true);
    expect(isValidXml("<root><child></root>")).toBe(false);
  });

  test("preserves declaration-order tolerance and delegates root policy to callers", () => {
    expect(isValidXml('<?xml encoding="UTF-8" version="1.0"?><root/>')).toBe(true);
    expect(isValidXml("<first/><second/>")).toBe(true);
  });
});
