import { describe, expect, test } from "bun:test";

import { WORD_NS } from "../../scripts/docx-baseline/corpus/builder";
import { resolveDocxLimits } from "../../src/docx/limits";
import { createNumberingResolver } from "../../src/docx/numbering";
import { parseXml, type Element } from "../../src/docx/xml";

function xml(source: string): Element {
  const parsed = parseXml(source);
  if (!parsed) throw new Error("Expected synthetic XML root");
  return parsed;
}

function numbering(contents: string): Element {
  return xml(`<w:numbering xmlns:w="${WORD_NS}">${contents}</w:numbering>`);
}

function styles(contents: string): Element {
  return xml(`<w:styles xmlns:w="${WORD_NS}">${contents}</w:styles>`);
}

function paragraph(properties = ""): Element {
  return xml(`<w:p xmlns:w="${WORD_NS}"><w:pPr>${properties}</w:pPr></w:p>`);
}

function numProperties(id: string, level?: string): string {
  return `<w:numPr><w:numId w:val="${id}"/>${level === undefined ? "" : `<w:ilvl w:val="${level}"/>`}</w:numPr>`;
}

function concrete(id: string, abstract: string, extra = ""): string {
  return `<w:num w:numId="${id}"><w:abstractNumId w:val="${abstract}"/>${extra}</w:num>`;
}

function abstract(id: string, contents: string): string {
  return `<w:abstractNum w:abstractNumId="${id}">${contents}</w:abstractNum>`;
}

function level(index: string | undefined, format = "decimal", extra = ""): string {
  return `<w:lvl${index === undefined ? "" : ` w:ilvl="${index}"`}><w:numFmt w:val="${format}"/>${extra}</w:lvl>`;
}

function numberingStyle(id: string, numId: string): string {
  return `<w:style w:type="numbering" w:styleId="${id}"><w:pPr>${numProperties(numId)}</w:pPr></w:style>`;
}

describe("DOCX numbering facts for heading selectors", () => {
  test("direct paragraph numbering distinguishes ordered and bullet levels, including numId zero", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("0", level("0", "bullet") + level("1", "lowerLetter")) + concrete("0", "0"),
      ),
      undefined,
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("0", "0")))).toEqual({
      isOrdered: false,
      levelIndex: 0,
    });
    expect(resolve(paragraph(numProperties("0", "1")))).toEqual({
      isOrdered: true,
      levelIndex: 1,
    });
    expect(resolve(paragraph(numProperties("0", "2")))).toBeUndefined();
  });

  test("an omitted format is ordered while an omitted level defaults to zero", () => {
    const resolve = createNumberingResolver(
      numbering(abstract("1", '<w:lvl w:ilvl="0"/>') + concrete("1", "1")),
      undefined,
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("1")))).toEqual({
      isOrdered: true,
      levelIndex: 0,
    });
  });

  test("a paragraph style selects its abstract level before the missing-level fallback", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("1", level("0", "decimal") + level("2", "bullet", '<w:pStyle w:val="List"/>')) +
          concrete("1", "1"),
      ),
      undefined,
      resolveDocxLimits(),
    );
    const style = '<w:pStyle w:val="List"/>';
    expect(resolve(paragraph(style))).toEqual({ isOrdered: false, levelIndex: 2 });
    expect(resolve(paragraph(style + numProperties("1")))).toEqual({
      isOrdered: false,
      levelIndex: 2,
    });
    expect(resolve(paragraph(style + numProperties("1", "0")))).toEqual({
      isOrdered: true,
      levelIndex: 0,
    });
    expect(resolve(paragraph(style + numProperties("missing", "0")))).toBeUndefined();
  });

  test("numbering styles can link through another concrete numbering definition", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("1", '<w:numStyleLink w:val="Linked"/>' + level("0", "bullet")) +
          abstract("2", level("0", "decimal")) +
          concrete("1", "1") +
          concrete("2", "2"),
      ),
      styles(numberingStyle("Linked", "2")),
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("1", "0")))).toEqual({
      isOrdered: true,
      levelIndex: 0,
    });
  });

  test("paragraph style numbering, inheritance and default styles do not supply list facts", () => {
    const styleDefinitions = styles(
      `<w:style w:type="paragraph" w:default="1" w:styleId="Base"><w:pPr>${numProperties("1", "0")}</w:pPr></w:style>` +
        '<w:style w:type="paragraph" w:styleId="Child"><w:basedOn w:val="Base"/></w:style>',
    );
    const resolve = createNumberingResolver(
      numbering(abstract("1", level("0")) + concrete("1", "1")),
      styleDefinitions,
      resolveDocxLimits(),
    );
    for (const style of [undefined, "Base", "Child"])
      expect(resolve(paragraph(style ? `<w:pStyle w:val="${style}"/>` : ""))).toBeUndefined();
  });

  test("level overrides do not replace the abstract format or its level index", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("1", level("0", "bullet")) +
          concrete(
            "1",
            "1",
            `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="9"/>${level("0", "decimal")}</w:lvlOverride>`,
          ),
      ),
      undefined,
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("1", "0")))).toEqual({
      isOrdered: false,
      levelIndex: 0,
    });
  });

  test("unindexed malformed levels fill zero only when an explicit zero is absent", () => {
    for (const levels of [
      level(undefined, "bullet"),
      level("0", "decimal") + level(undefined, "bullet"),
      level(undefined, "bullet") + level("0", "decimal"),
    ]) {
      const resolve = createNumberingResolver(
        numbering(abstract("1", levels) + concrete("1", "1")),
        undefined,
        resolveDocxLimits(),
      );
      expect(resolve(paragraph(numProperties("1")))).toEqual({
        isOrdered: levels.includes('w:ilvl="0"'),
        levelIndex: 0,
      });
    }
  });

  test("duplicate abstract and concrete IDs use their last definitions", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("1", level("0", "decimal")) +
          abstract("1", level("0", "bullet")) +
          abstract("2", level("0", "decimal")) +
          concrete("1", "2") +
          concrete("1", "1"),
      ),
      undefined,
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("1", "0")))).toEqual({
      isOrdered: false,
      levelIndex: 0,
    });
  });

  test("duplicate paragraph style links follow numeric abstract-ID enumeration order", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("2", level("2", "bullet", '<w:pStyle w:val="List"/>')) +
          abstract("1", level("1", "decimal", '<w:pStyle w:val="List"/>')),
      ),
      undefined,
      resolveDocxLimits(),
    );
    expect(resolve(paragraph('<w:pStyle w:val="List"/>'))).toEqual({
      isOrdered: false,
      levelIndex: 2,
    });
  });

  test("duplicate numbering style IDs retain the first definition", () => {
    const resolve = createNumberingResolver(
      numbering(
        abstract("1", '<w:numStyleLink w:val="Linked"/>') +
          abstract("2", level("0", "bullet")) +
          abstract("3", level("0", "decimal")) +
          concrete("1", "1") +
          concrete("2", "2") +
          concrete("3", "3"),
      ),
      styles(numberingStyle("Linked", "2") + numberingStyle("Linked", "3")),
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("1", "0")))).toEqual({
      isOrdered: false,
      levelIndex: 0,
    });
  });

  test("missing definitions yield no list while a selected missing numbering style fails", () => {
    const resolve = createNumberingResolver(
      numbering(
        concrete("1", "missing") +
          abstract("2", '<w:numStyleLink w:val="Missing"/>') +
          concrete("2", "2"),
      ),
      undefined,
      resolveDocxLimits(),
    );
    expect(resolve(paragraph(numProperties("missing", "0")))).toBeUndefined();
    expect(resolve(paragraph(numProperties("1", "0")))).toBeUndefined();
    expect(() => resolve(paragraph(numProperties("2", "0")))).toThrow(
      "docx_numbering_style_missing",
    );
    expect(() =>
      createNumberingResolver(numbering('<w:num w:numId="1"/>'), undefined, resolveDocxLimits()),
    ).toThrow("docx_numbering_invalid");
  });

  test("missing numbering and run nodes never acquire paragraph list facts", () => {
    const resolve = createNumberingResolver(undefined, undefined, resolveDocxLimits());
    expect(resolve(paragraph(numProperties("1", "0")))).toBeUndefined();
    expect(resolve(xml(`<w:r xmlns:w="${WORD_NS}"/>`))).toBeUndefined();
  });

  test("selected style-link traversal accepts its exact work cap and fails below it", () => {
    const definitions = numbering(
      abstract("1", '<w:numStyleLink w:val="Linked"/>') +
        abstract("2", level("0")) +
        concrete("1", "1") +
        concrete("2", "2"),
    );
    const styleDefinitions = styles(numberingStyle("Linked", "2"));
    const selected = paragraph(numProperties("1", "0"));
    for (const maxStyleTraversalSteps of [3, 4, 5]) {
      const resolve = createNumberingResolver(
        definitions,
        styleDefinitions,
        resolveDocxLimits({ maxStyleTraversalSteps }),
      );
      if (maxStyleTraversalSteps < 4)
        expect(() => resolve(selected)).toThrow("docx_limit:maxStyleTraversalSteps");
      else expect(resolve(selected)).toEqual({ isOrdered: true, levelIndex: 0 });
    }
  });

  test("self and mutual numbering-style cycles stop at the traversal limit", () => {
    for (const target of ["1", "2"]) {
      const resolve = createNumberingResolver(
        numbering(
          abstract("1", '<w:numStyleLink w:val="First"/>') +
            abstract("2", '<w:numStyleLink w:val="Second"/>') +
            concrete("1", "1") +
            concrete("2", "2"),
        ),
        styles(numberingStyle("First", target) + numberingStyle("Second", "1")),
        resolveDocxLimits({ maxStyleTraversalSteps: 8 }),
      );
      expect(() => resolve(paragraph(numProperties("1", "0")))).toThrow(
        "docx_limit:maxStyleTraversalSteps",
      );
    }
  });
});
