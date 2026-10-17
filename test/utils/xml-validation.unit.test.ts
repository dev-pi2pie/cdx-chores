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

  for (const [name, xml] of [
    ["empty input", ""],
    ["unclosed elements", "<root>"],
    ["duplicate attributes", '<root value="one" value="two"/>'],
    ["text control characters", "<root>\u0001</root>"],
    ["attribute control characters", '<root value="\u0001"/>'],
    ["malformed element names", "<a:b:c/>"],
    ["malformed attribute names", '<root a:b:c="value"/>'],
    ["XML 1.0 prefix undeclaration", '<root xmlns:w=""/>'],
    ["repeated DOCTYPE declarations", "<!DOCTYPE root><!DOCTYPE root><root/>"],
    ["misplaced DOCTYPE declarations", "<root><!DOCTYPE root></root>"],
    ["bare text ampersands", "<root>A&B</root>"],
    ["malformed numeric references", "<root>&#xZZ;</root>"],
  ] as const) {
    test(`rejects ${name} without leaking validator exceptions`, () => {
      expect(isValidXml(xml)).toBe(false);
    });
  }

  test("validation failures do not affect later calls", () => {
    for (const xml of ["<broken>", "<root>\u0001</root>", "<a:b:c/>"]) {
      expect(isValidXml(xml)).toBe(false);
      expect(isValidXml('<root value="next"><child/></root>')).toBe(true);
    }
  });

  test("retains XML 1.1 prefix undeclaration and undeclared-prefix handling", () => {
    expect(isValidXml('<?xml version="1.1"?><root xmlns:w=""><w:child/></root>')).toBe(true);
    expect(isValidXml("<root><w:child/></root>")).toBe(true);
    expect(isValidXml('<root xmlns=""/>')).toBe(true);
  });

  test("leaves optional sequence checks and literal sections unchanged", () => {
    expect(isValidXml('<root value="<"><!-- a--b -->]]></root>')).toBe(true);
    expect(isValidXml("<root><![CDATA[A&B &unknown; <literal/>]]><?after data?></root>")).toBe(
      true,
    );
    expect(isValidXml("<![CDATA[before]]><root/><![CDATA[after]]>")).toBe(true);
  });
});
