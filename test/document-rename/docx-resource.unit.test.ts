import { describe, expect, test } from "bun:test";

import { buildStoredZip, documentXml, paragraph } from "./fixtures/docx-baseline/corpus/builder";
import { createResourceCases, RESOURCE_BOUNDARIES } from "./fixtures/docx-baseline/resource-cases";
import {
  DEFAULT_DOCX_LIMITS,
  DocxLimitError,
  checkDocxLimit,
  resolveDocxLimits,
  type DocxLimits,
} from "../../src/docx/limits";
import { openGuardedDocxPackage } from "../../src/docx/package";
import { readDocxDocument } from "../../src/docx/reader";
import { XmlBudget } from "../../src/docx/xml-budget";
import { ampersandHeavyDocument } from "./fixtures/docx-ampersand-cases";
import {
  BOUNDARY_SENTINEL,
  createSelectedBoundaryProbes,
  ORIGINAL_RESOURCE_RECONCILIATION,
} from "./fixtures/docx-boundary-probes";

describe("private DOCX limit policy", () => {
  test("ampersand-heavy content uses original selected bytes at the part cap", async () => {
    for (const offset of [0, 1]) {
      const { xml, rawText } = ampersandHeavyDocument(
        DEFAULT_DOCX_LIMITS.maxPartDecompressedBytes + offset,
      );
      const result = await readDocxDocument(buildStoredZip([["word/document.xml", xml]]));
      if (offset)
        expect(result).toEqual({ ok: false, diagnostic: "docx_limit:maxPartDecompressedBytes" });
      else {
        expect(result.ok, JSON.stringify(result)).toBe(true);
        if (result.ok) expect(result.facts.rawText).toBe(rawText);
      }
    }
  });

  test("byte and structural cap checks accept equality and reject only above", () => {
    for (const key of [
      "compressedInputBytes",
      "entryCount",
      "maxPartDecompressedBytes",
      "totalDecompressedBytes",
      "xmlElementCount",
      "maxXmlDepth",
      "maxStyleTraversalSteps",
      "peakRssBytes",
      "requestMetadataBytes",
      "resultBytes",
    ] as const) {
      const limits = resolveDocxLimits({ [key]: 8 });
      expect(() => checkDocxLimit(7, key, limits)).not.toThrow();
      expect(() => checkDocxLimit(8, key, limits)).not.toThrow();
      try {
        checkDocxLimit(9, key, limits);
        throw new Error(`Expected limit failure for ${key}`);
      } catch (error) {
        expect(error).toBeInstanceOf(DocxLimitError);
        expect((error as DocxLimitError).limit).toBe(key);
        expect((error as Error).message).toBe(`docx_limit:${key}`);
      }
    }
  });

  test("resolves a separate request value without mutating provisional defaults", () => {
    const first = resolveDocxLimits({ compressedInputBytes: 0, resultBytes: 1 });
    const second = resolveDocxLimits();
    Object.assign(first, { resultBytes: 2 });
    expect(second.resultBytes).toBe(DEFAULT_DOCX_LIMITS.resultBytes);
    expect(second.compressedInputBytes).toBe(DEFAULT_DOCX_LIMITS.compressedInputBytes);
  });

  test("rejects invalid numeric values and timers Node cannot represent", () => {
    for (const value of [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => resolveDocxLimits({ entryCount: value })).toThrow("docx_limits_invalid");
    }
    for (const key of [
      "elapsedMilliseconds",
      "rssSampleMilliseconds",
      "termGraceMilliseconds",
      "cleanupMilliseconds",
    ] as const) {
      expect(() => resolveDocxLimits({ [key]: 0 })).toThrow("docx_limits_invalid");
      expect(() => resolveDocxLimits({ [key]: 2 ** 31 })).toThrow("docx_limits_invalid");
      expect(resolveDocxLimits({ [key]: 2 ** 31 - 1 })[key]).toBe(2 ** 31 - 1);
    }
  });

  test("rejects unknown own keys, including names inherited by ordinary objects", () => {
    for (const key of ["unknown", "constructor", "toString", "__proto__", "prototype"]) {
      const override = JSON.parse(`{"${key}":1}`) as Partial<DocxLimits>;
      expect(() => resolveDocxLimits(override)).toThrow("docx_limits_invalid");
    }
  });
});

const main = documentXml(paragraph("Boundary report"));
const minimalDocx = () => buildStoredZip([["word/document.xml", main]]);

describe("selected DOCX resource enforcement", () => {
  test("reconciles all frozen whole-package boundaries with default selected-part enforcement", async () => {
    const cases = createResourceCases();
    expect(cases.length).toBe(21);
    expect(RESOURCE_BOUNDARIES.length).toBe(cases.length);
    for (const [index, item] of cases.entries()) {
      const boundary = RESOURCE_BOUNDARIES[index]!;
      expect(item.id).toBe(boundary.caseId);
      expect(boundary.proposedCap).toBe(DEFAULT_DOCX_LIMITS[boundary.metric]);
      if (!("bytes" in item.input)) throw new Error("Expected synthetic resource bytes");
      const result = await readDocxDocument(item.input.bytes);
      const policy = ORIGINAL_RESOURCE_RECONCILIATION[boundary.metric];
      if (boundary.position === "above" && policy.selected)
        expect(result, item.id).toEqual({ ok: false, diagnostic: policy.aboveDiagnostic });
      else {
        expect(result.ok, `${item.id}: ${JSON.stringify(result)}`).toBe(true);
        if (result.ok) expect(result.facts.rawText).toContain("Resource boundary sentinel");
      }
    }
  });

  test("enforces actual selected aggregate bytes, XML elements, and style/numbering work at default caps", async () => {
    let checked = 0;
    for (const probe of createSelectedBoundaryProbes()) {
      const result = await readDocxDocument(probe.bytes);
      if (probe.observed > DEFAULT_DOCX_LIMITS[probe.metric])
        expect(result, probe.id).toEqual({ ok: false, diagnostic: `docx_limit:${probe.metric}` });
      else {
        expect(result.ok, `${probe.id}: ${JSON.stringify(result)}`).toBe(true);
        if (result.ok) {
          expect(result.facts.rawText, probe.id).toContain(BOUNDARY_SENTINEL);
          if (
            probe.id.startsWith("selected-style-work") ||
            probe.id.startsWith("selected-numbering-work")
          )
            expect(result.facts.headings, probe.id).toEqual([
              {
                level: probe.id.startsWith("selected-style-work") ? 1 : 2,
                text: BOUNDARY_SENTINEL,
              },
            ]);
        }
      }
      checked += 1;
    }
    expect(checked).toBe(12);
  });

  for (const key of [
    "compressedInputBytes",
    "entryCount",
    "xmlElementCount",
    "maxXmlDepth",
  ] as const) {
    test(`${key} independently accepts below/equal and rejects above`, async () => {
      // This selected document has exactly five XML elements and five nested levels.
      const bytes = minimalDocx();
      const observed = key === "compressedInputBytes" ? bytes.length : key === "entryCount" ? 1 : 5;
      for (const offset of [-1, 0, 1]) {
        const result = await readDocxDocument(
          bytes,
          resolveDocxLimits({ [key]: observed + offset }),
        );
        if (offset < 0) expect(result).toEqual({ ok: false, diagnostic: `docx_limit:${key}` });
        else {
          expect(result.ok).toBe(true);
          if (result.ok) expect(result.facts.rawText).toBe("Boundary report\n\n");
        }
      }
    });
  }

  test("counts duplicate physical entry headers and unselected binary headers", async () => {
    const bytes = buildStoredZip([
      ["word/document.xml", main],
      ["opaque.bin", Buffer.alloc(1)],
      ["word/document.xml", main],
    ]);
    expect(await readDocxDocument(bytes, resolveDocxLimits({ entryCount: 2 }))).toEqual({
      ok: false,
      diagnostic: "docx_limit:entryCount",
    });
    for (const entryCount of [3, 4]) {
      expect((await readDocxDocument(bytes, resolveDocxLimits({ entryCount }))).ok).toBe(true);
    }
  });

  test("caps each selected part and closes the archive after a part overflow", async () => {
    const bytes = buildStoredZip([["one.xml", "123456"]]);
    for (const maxPartDecompressedBytes of [5, 6, 7]) {
      const archive = await openGuardedDocxPackage(
        bytes,
        resolveDocxLimits({ maxPartDecompressedBytes }),
      );
      try {
        if (maxPartDecompressedBytes < 6) {
          await expect(archive.readText("/one.xml")).rejects.toThrow(
            "docx_limit:maxPartDecompressedBytes",
          );
          expect(archive.closed).toBe(true);
          await expect(archive.readText("/one.xml")).rejects.toThrow("docx_package_unavailable");
        } else expect(await archive.readText("/one.xml")).toBe("123456");
      } finally {
        await archive.close();
        await archive.close();
      }
      expect(archive.closed).toBe(true);
    }
  });

  test("charges total actual selected bytes once and closes an active overflow stream", async () => {
    const bytes = buildStoredZip([
      ["one.xml", "123"],
      ["two.xml", "456"],
    ]);
    for (const totalDecompressedBytes of [5, 6, 7]) {
      const archive = await openGuardedDocxPackage(
        bytes,
        resolveDocxLimits({ totalDecompressedBytes }),
      );
      try {
        expect(await archive.readText("/one.xml")).toBe("123");
        expect(await archive.readText("one.xml")).toBe("123");
        if (totalDecompressedBytes < 6) {
          await expect(archive.readText("/two.xml")).rejects.toThrow(
            "docx_limit:totalDecompressedBytes",
          );
          expect(archive.closed).toBe(true);
        } else expect(await archive.readText("/two.xml")).toBe("456");
      } finally {
        await archive.close();
      }
      expect(archive.closed).toBe(true);
    }
  });

  test("caches selected bytes by physical entry across metadata and content selection", async () => {
    for (const duplicate of [false, true]) {
      const archive = await openGuardedDocxPackage(
        buildStoredZip([
          ["part.xml", "first"],
          ...(duplicate ? [["part.xml", Buffer.alloc(256 * 1024 + 1)] as [string, Buffer]] : []),
        ]),
        resolveDocxLimits({ totalDecompressedBytes: 5 }),
      );
      try {
        expect(await archive.readMetadataText("/part.xml")).toBe("first");
        expect(await archive.readMetadataText("part.xml")).toBe("first");
        if (duplicate) {
          await expect(archive.readText("/part.xml")).rejects.toThrow(
            "docx_limit:totalDecompressedBytes",
          );
          expect(archive.closed).toBe(true);
        } else expect(await archive.readText("/part.xml")).toBe("first");
      } finally {
        await archive.close();
      }
    }
  });

  test("does not inflate or inspect unselected content", async () => {
    const bytes = buildStoredZip([
      ["word/document.xml", main],
      ["unselected.xml", "<".repeat(4_096)],
      ["opaque.bin", Buffer.alloc(4_096)],
    ]);
    const result = await readDocxDocument(
      bytes,
      resolveDocxLimits({
        maxPartDecompressedBytes: Buffer.byteLength(main),
        totalDecompressedBytes: Buffer.byteLength(main),
        xmlElementCount: 5,
        maxXmlDepth: 5,
      }),
    );
    expect(result.ok).toBe(true);
  });

  test("selected style work is bounded per lookup rather than unused inheritance graphs", async () => {
    // Names lookup, one failed explicit rule, then the matching Heading1 ID: three steps.
    const bytes = buildStoredZip([
      [
        "word/document.xml",
        documentXml(
          paragraph("Styled report", "Heading1") + paragraph("Second report", "Heading1"),
        ),
      ],
      ["mammoth/style-map", "p.Unrelated => h2:fresh"],
    ]);
    expect(await readDocxDocument(bytes, resolveDocxLimits({ maxStyleTraversalSteps: 2 }))).toEqual(
      {
        ok: false,
        diagnostic: "docx_limit:maxStyleTraversalSteps",
      },
    );
    for (const maxStyleTraversalSteps of [3, 4]) {
      const result = await readDocxDocument(bytes, resolveDocxLimits({ maxStyleTraversalSteps }));
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.facts.headings.map((heading) => heading.text)).toEqual([
          "Styled report",
          "Second report",
        ]);
    }
  });

  test("concurrent reads and duplicate close calls settle pending stream creation", async () => {
    const archive = await openGuardedDocxPackage(
      buildStoredZip([
        ["one.xml", "123"],
        ["two.xml", "456"],
      ]),
      resolveDocxLimits(),
    );
    const first = archive.readText("/one.xml");
    const second = archive.readText("/two.xml");
    const settled = Promise.allSettled([first, second]);
    await Promise.all([archive.close(), archive.close()]);
    expect(archive.closed).toBe(true);
    expect((await settled).map((result) => result.status)).toEqual(["rejected", "rejected"]);
    await expect(archive.readText("/one.xml")).rejects.toThrow("docx_package_unavailable");
  });

  test("XML scans ignore comment/CDATA markup and bound aggregate distinct selected parts", () => {
    const budget = new XmlBudget(resolveDocxLimits({ xmlElementCount: 3, maxXmlDepth: 2 }));
    const first = '<root value=">"><!--<ignored/>--><![CDATA[<ignored/>]]><child/></root>';
    expect(() => budget.inspect("/one.xml", first)).not.toThrow();
    expect(() => budget.inspect("/one.xml", first)).not.toThrow();
    expect(() => budget.inspect("/two.xml", "<root/>")).not.toThrow();
    expect(() => budget.inspect("/three.xml", "<root/>")).toThrow("docx_limit:xmlElementCount");
  });

  test("malformed physical parts consume XML elements once and replay their failure", () => {
    const budget = new XmlBudget(resolveDocxLimits({ xmlElementCount: 3 }));
    const part = {};
    for (let attempt = 0; attempt < 3; attempt += 1)
      expect(() => budget.inspect(part, "<root><child/>")).toThrow("docx_xml_invalid");
    // The failed scan consumed two elements; a distinct part still consumes the third.
    expect(() => budget.inspect({}, "<last/>")).not.toThrow();
    expect(() => budget.inspect({}, "<overflow/>")).toThrow("docx_limit:xmlElementCount");
  });

  test("repeated physical parts cannot bypass a cached XML safety failure", () => {
    for (const [limits, xml, diagnostic] of [
      [{ xmlElementCount: 1 }, "<root><child/></root>", "docx_limit:xmlElementCount"],
      [{ maxXmlDepth: 1 }, "<root><child/></root>", "docx_limit:maxXmlDepth"],
      [{}, "<!DOCTYPE root><root/>", "docx_xml_declaration_unsupported"],
    ] as const) {
      const budget = new XmlBudget(resolveDocxLimits(limits));
      const part = {};
      for (let attempt = 0; attempt < 2; attempt += 1)
        expect(() => budget.inspect(part, xml)).toThrow(diagnostic);
    }
  });

  test("built-in XML references remain bounded by selected-part and result limits", async () => {
    const count = 100_001;
    const bytes = buildStoredZip([
      [
        "word/document.xml",
        documentXml(`<w:p><w:r><w:t>${"&#65;".repeat(count)}</w:t></w:r></w:p>`),
      ],
    ]);
    const result = await readDocxDocument(bytes);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) throw new Error(result.diagnostic);
    expect(result.facts.rawText).toBe("A".repeat(count) + "\n\n");
    expect(
      await readDocxDocument(bytes, resolveDocxLimits({ maxPartDecompressedBytes: 100 })),
    ).toEqual({
      ok: false,
      diagnostic: "docx_limit:maxPartDecompressedBytes",
    });
    expect(await readDocxDocument(bytes, resolveDocxLimits({ resultBytes: 100 }))).toEqual({
      ok: false,
      diagnostic: "docx_limit:resultBytes",
    });
  });

  test("rejects declarations before entity expansion and closes failed selected reads", async () => {
    const result = await readDocxDocument(
      buildStoredZip([
        [
          "word/document.xml",
          '<!DOCTYPE root [<!ENTITY payload "expanded">]><root>&payload;</root>',
        ],
      ]),
    );
    expect(result).toEqual({ ok: false, diagnostic: "docx_xml_declaration_unsupported" });

    const bytes = buildStoredZip([["one.xml", "123"]]);
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt16LE(99, 8);
    bytes.writeUInt16LE(99, central + 10);
    const archive = await openGuardedDocxPackage(bytes, resolveDocxLimits());
    try {
      await expect(archive.readText("/one.xml")).rejects.toThrow();
      expect(archive.closed).toBe(true);
    } finally {
      await archive.close();
    }
  });
});
