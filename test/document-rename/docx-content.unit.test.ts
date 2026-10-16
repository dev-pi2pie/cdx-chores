import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  buildDocxPackage,
  buildStoredZip,
  coreXml,
  documentXml,
  paragraph,
  REL_NS,
  run,
  style,
  stylesXml,
  WORD_NS,
  xmlEscape,
  type DocxPackageOptions,
} from "./fixtures/docx-baseline/corpus/builder";
import { assembleDocxEvidence } from "../../src/adapters/codex/document-rename/extractors/docx-evidence";
import { resolveDocxLimits, type DocxLimits } from "../../src/docx/limits";
import { readDocxDocument } from "../../src/docx/reader";
import { readSymbol } from "../../src/docx/symbols";
import { styleProjection } from "../../src/docx/styles";
import { XmlBudget } from "../../src/docx/xml-budget";
import type { DocxDocumentFacts } from "../../src/docx/types";
import { children, elementText, first, parseXml } from "../../src/docx/xml";
import { createAdditionalDocxContentProbes } from "./fixtures/docx-content-probes";
import { createDocxReviewCases } from "./fixtures/docx-review-cases";
import { createDocxXmlCases } from "./fixtures/docx-xml-cases";
import {
  createDocxAmpersandCases,
  createDocxAmpersandClassificationCases,
} from "./fixtures/docx-ampersand-cases";

function symbol(font: string | undefined, char: string | undefined): string {
  return `<w:r><w:sym${font === undefined ? "" : ` w:font="${xmlEscape(font)}"`}${char === undefined ? "" : ` w:char="${xmlEscape(char)}"`}/></w:r>`;
}

function styled(contents: string, id: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="${xmlEscape(id)}"/></w:pPr>${contents}</w:p>`;
}

function reference(id: number, kind = "footnote"): string {
  return `<w:r><w:${kind}Reference w:id="${id}"/></w:r>`;
}

function notes(contents: string, kind = "footnote"): [string, string] {
  return [`word/${kind}s.xml`, `<w:${kind}s xmlns:w="${WORD_NS}">${contents}</w:${kind}s>`];
}

function note(id: number, contents: string, kind = "footnote"): string {
  return `<w:${kind} w:id="${id}">${contents}</w:${kind}>`;
}

async function facts(
  options: DocxPackageOptions,
  limits: Partial<DocxLimits> = {},
): Promise<DocxDocumentFacts> {
  const result = await readDocxDocument(buildDocxPackage(options), resolveDocxLimits(limits));
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.diagnostic);
  return result.facts;
}

function evidence(value: DocxDocumentFacts) {
  return assembleDocxEvidence("synthetic.docx", { ...value, extractor: "docx-reader" });
}

describe("DOCX review follow-up content cases", () => {
  test("ampersand classification preserves mixed literals and exact references", () => {
    const source = "A &amp-foo; &b=2; &é; &amp; &#38; &amp;#38;";
    for (const quote of ['"', "'"]) {
      const root = parseXml(`<root value=${quote}${source}${quote}>${source}</root>`)!;
      expect(root.attributes.get("value")).toBe("A &amp-foo; &b=2; &é; & & &#38;");
      expect(elementText(root)).toBe("A &amp-foo; &b=2; &é; & & &#38;");
    }
  });

  test("ampersand classification stays within each quoted value and text span", () => {
    for (const quote of ['"', "'"]) {
      const root = parseXml(`<root value=${quote}&tail${quote}>; &b=2;</root>`)!;
      expect(root.attributes.get("value")).toBe("&tail");
      expect(elementText(root)).toBe("; &b=2;");
    }
  });

  test("literal lookalikes preserve named and numeric reference failure boundaries", () => {
    for (const reference of ["&am;", "&ampx;", "&_name;", "&123;"]) {
      for (const quote of ['"', "'"])
        expect(() => parseXml(`<root value=${quote}&amp-foo; ${reference}${quote}/>`)).toThrow(
          "docx_xml_invalid",
        );
      expect(() => parseXml(`<root>&amp-foo; ${reference}</root>`)).toThrow("docx_xml_invalid");
    }
    for (const reference of ["&#xZZ;", "&#"])
      expect(() => parseXml(`<root>&amp-foo; ${reference}</root>`)).toThrow("docx_xml_invalid");
  });

  test("bare ampersands in XML values remain literal alongside references", () => {
    for (const quote of ['"', "'"]) {
      const root = parseXml(
        `<root value=${quote}AT&T & &amp; &#38; &#x26; &amp;#38; &copy &;${quote}>Research & Development &amp; &#38; &#x26; &amp;#38; &copy &;</root>`,
      )!;
      expect(root.attributes.get("value")).toBe("AT&T & & & & &#38; &copy &;");
      expect(elementText(root)).toBe("Research & Development & & & &#38; &copy &;");
    }
  });

  test("bare-ampersand recovery leaves comments, instructions, and CDATA literal", () => {
    const root = parseXml(
      `<!-- <ignored value="&unknown;"/> --><?before value="&unknown;"?><root value="A&B\t&#9;"><![CDATA[A&B &unknown; &#38;]]> & C</root>`,
    )!;
    expect(root.attributes.get("value")).toBe("A&B \t");
    expect(elementText(root)).toBe("A&B &unknown; &#38; & C");
  });

  test("bare-ampersand recovery cannot repair markup or hide entity failures", () => {
    for (const xml of [
      '<root value="A&B">&unknown;</root>',
      '<root value="A&B &copy;"/>',
      '<root value="A&B">&#xZZ;</root>',
      '<root value="A&B">&#</root>',
      '<r&oot value="A&B"/>',
      '<root a&b="A&B"/>',
      "<root value=A&B/>",
      '<root value="A&B"/><extra/>',
      '<root value="A&B"></wrong>',
      '<root value="A&B"/><![CDATA[&]]>',
    ])
      expect(() => parseXml(xml), xml).toThrow("docx_xml_invalid");
    expect(() => parseXml('<!DOCTYPE root><root value="A&B"/>')).toThrow(
      "docx_xml_declaration_unsupported",
    );
  });

  test("bare-ampersand recovery preserves original physical-part charging", () => {
    const budget = new XmlBudget(resolveDocxLimits({ xmlElementCount: 1 }));
    const part = {};
    for (let attempt = 0; attempt < 2; attempt++)
      expect(parseXml('<root value="A&B"/>', budget, part)?.attributes.get("value")).toBe("A&B");
    expect(() => parseXml("<over/>", budget, {})).toThrow("docx_limit:xmlElementCount");
  });

  test("literal attribute whitespace normalizes before references decode", () => {
    for (const quote of ['"', "'"]) {
      const root = parseXml(
        `<root value=${quote} a\t\n\r\r\nb &#9;&#10;&#13;&#x9;&#xA;&#xD; &amp;#10; &quot;&apos; > ${quote}/>`,
      )!;
      expect(root.attributes.get("value")).toBe(" a    b \t\n\r\t\n\r &#10; \"' > ");
    }
  });

  test("attribute normalization leaves text and literal sections untouched", () => {
    const root = parseXml(
      `<!-- <fake value="comment\tline"/> --><?before value="instruction\tline"?><root value="attribute\tline">text\tline\r\n<![CDATA[<fake value="literal\tline"/>]]><child value='child\tline'/></root>`,
    )!;
    expect(root.attributes.get("value")).toBe("attribute line");
    expect(first(root, "child")?.attributes.get("value")).toBe("child line");
    expect(elementText(root)).toBe('text\tline\n<fake value="literal\tline"/>');
  });

  test("namespace declaration values use the same literal whitespace rules", () => {
    const root = parseXml(
      '<a:root xmlns:a="urn:literal\tspace" xmlns:b="urn:reference&#9;space"><b:child/></a:root>',
    )!;
    expect(root.name).toBe("{urn:literal space}:root");
    expect(children(root)[0]?.name).toBe("{urn:reference\tspace}:child");
  });

  test("attribute normalization preserves original physical-part charging", () => {
    const budget = new XmlBudget(resolveDocxLimits({ xmlElementCount: 1 }));
    const part = {};
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        parseXml('<root value="literal\tspace"/>', budget, part)?.attributes.get("value"),
      ).toBe("literal space");
    expect(() => parseXml("<over/>", budget, {})).toThrow("docx_limit:xmlElementCount");
    expect(() => parseXml('<root value="literal\tspace"/>', budget, {})).toThrow(
      "docx_limit:xmlElementCount",
    );
  });

  test("unbound prefixes cannot become semantic element or attribute names", () => {
    expect(parseXml("<w:p/>")?.name).not.toBe("w:p");
    const root = parseXml(`<x:p xmlns:x="${WORD_NS}" w:val="unbound" val="plain"/>`)!;
    expect(root.name).toBe("w:p");
    expect(root.attributes.has("w:val")).toBe(false);
    expect(root.attributes.get("val")).toBe("plain");
  });

  test("namespace bindings inherit and local rebinding ends with its element", () => {
    const root = parseXml(
      `<p xmlns="${WORD_NS}" xmlns:w="${WORD_NS}"><w:r xmlns:w="urn:foreign"/><w:r/></p>`,
    )!;
    expect(root.name).toBe("w:p");
    expect(children(root).map((child) => child.name)).toEqual(["{urn:foreign}:r", "w:r"]);
  });

  test("nonempty trailing CDATA fails, including whitespace and literal markup", () => {
    for (const text of ["extra", " ", "\n", "<extra/>"])
      expect(() => parseXml(`<root/><?after data?><![CDATA[${text}]]>`)).toThrow(
        "docx_xml_invalid",
      );
  });

  test("leading and empty trailing CDATA preserve their historical root behavior", () => {
    const root = parseXml("<![CDATA[leading]]><root/><!-- after --><![CDATA[]]><?after data?>");
    expect(root?.name).toBe("root");
  });

  test("CDATA stays literal and ordered alongside ordinary and empty text", () => {
    const root = parseXml(
      "<root>Before<![CDATA[]]><![CDATA[ ]]><![CDATA[&#65; &copy; <extra/>]]>After</root>",
    )!;
    expect(elementText(root)).toBe("Before &#65; &copy; <extra/>After");
  });

  test("CDATA records do not consume XML element budget", () => {
    const budget = new XmlBudget(resolveDocxLimits({ xmlElementCount: 2 }));
    const part = {};
    const xml = "<root><![CDATA[<extra/>]]><child/></root>";
    for (let attempt = 0; attempt < 2; attempt++) {
      const root = parseXml(xml, budget, part)!;
      expect(elementText(root)).toBe("<extra/>");
      expect(first(root, "child")?.name).toBe("child");
    }
    expect(() => parseXml("<over/>", budget, {})).toThrow("docx_limit:xmlElementCount");
  });

  test("empty and prolog-only XML remain invalid", () => {
    for (const xml of ["", '<?xml version="1.0"?>', "<?only data?>"])
      expect(() => parseXml(xml)).toThrow("docx_xml_invalid");
  });

  for (const xml of [
    "<root/><extra/>",
    "<root/><root/>",
    "<root/><?between data?><!-- <ignored/> --><extra/>",
  ]) {
    test(`rejects multiple document elements: ${xml}`, () => {
      expect(() => parseXml(xml)).toThrow("docx_xml_invalid");
    });
  }

  test("one document root permits nested elements, comments, and processing instructions", () => {
    const root = parseXml(
      '<?xml version="1.0"?>\n<!-- <ignored/> --><?before data?><root><root>Report</root></root><?after data?>',
    )!;
    expect(root.name).toBe("root");
    expect(elementText(root)).toBe("Report");
  });

  test("root validation preserves physical-part charging", () => {
    const budget = new XmlBudget(resolveDocxLimits({ xmlElementCount: 3 }));
    const part = {};
    const xml = "<root/><extra/>";
    for (let attempt = 0; attempt < 2; attempt++)
      expect(() => parseXml(xml, budget, part)).toThrow("docx_xml_invalid");
    expect(parseXml("<last/>", budget, {})?.name).toBe("last");
    expect(() => parseXml("<over/>", budget, {})).toThrow("docx_limit:xmlElementCount");
  });

  test("content root validation retains the separate optional metadata policy", async () => {
    const value = await facts({
      body: paragraph("Main report", "Heading1"),
      core: `${coreXml("Metadata title")}<extra/>`,
    });
    expect(value.metadataResult).toEqual({ metadata: { title: "Metadata title" }, warnings: [] });
  });

  test("XML references decode once while comments, instructions, and CDATA stay literal", () => {
    const root = parseXml(
      '<root value="&quot;&#169;&amp;#169;"><!-- &copy; --><?literal &copy;?><![CDATA[&copy; &#169;]]>&#65;</root>',
    )!;
    expect(root.attributes.get("value")).toBe('"©&#169;');
    expect(elementText(root)).toBe("&copy; &#169;A");
  });

  for (const item of [
    ...createDocxReviewCases(),
    ...createDocxXmlCases(),
    ...createDocxAmpersandCases(),
    ...createDocxAmpersandClassificationCases(),
  ]) {
    test(item.id, async () => {
      const result = await readDocxDocument(buildDocxPackage(item.options));
      if (item.diagnostic) {
        expect(result).toEqual({ ok: false, diagnostic: item.diagnostic });
        return;
      }
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (!result.ok) throw new Error(result.diagnostic);
      expect(result.facts.rawText).toBe(item.rawText!);
      expect(result.facts.headings).toEqual(item.headings!);
      expect(result.facts.hasContent).toBe(true);
    });
  }

  test("Strong fallback consumes a lookup step after embedded rules", () => {
    const styles = parseXml(
      stylesXml(
        '<w:style w:type="character" w:styleId="Important"><w:name w:val="Strong"/></w:style>',
      ),
    );
    const node = parseXml(
      `<w:r xmlns:w="${WORD_NS}"><w:rPr><w:rStyle w:val="Important"/></w:rPr></w:r>`,
    )!;
    for (const maxStyleTraversalSteps of [1, 2]) {
      const project = styleProjection(
        styles,
        undefined,
        resolveDocxLimits({ maxStyleTraversalSteps }),
        new Set(),
      );
      if (maxStyleTraversalSteps === 1)
        expect(() => project("r", node)).toThrow("docx_limit:maxStyleTraversalSteps");
      else expect(project("r", node)?.[0]?.names).toEqual(["strong"]);
    }
    const overridden = styleProjection(
      styles,
      "r.Important => !",
      resolveDocxLimits({ maxStyleTraversalSteps: 2 }),
      new Set(),
    );
    expect(overridden("r", node)).toBeNull();
    for (const maxStyleTraversalSteps of [2, 3]) {
      const unmatched = styleProjection(
        styles,
        "r.Other => !",
        resolveDocxLimits({ maxStyleTraversalSteps }),
        new Set(),
      );
      if (maxStyleTraversalSteps === 2)
        expect(() => unmatched("r", node)).toThrow("docx_limit:maxStyleTraversalSteps");
      else expect(unmatched("r", node)?.[0]?.names).toEqual(["strong"]);
    }
  });
});

describe("DOCX symbol evidence boundaries", () => {
  test("preserves all 1061 baseline mappings across the complete five-font byte domain", () => {
    const rows: [string, string, string][] = [];
    const counts: number[] = [];
    for (const font of ["Symbol", "Webdings", "Wingdings", "Wingdings 2", "Wingdings 3"]) {
      let mapped = 0;
      for (let code = 0; code <= 255; code += 1) {
        const character = code.toString(16).toUpperCase().padStart(2, "0");
        const text = readSymbol(
          {
            name: "w:sym",
            attributes: new Map([
              ["w:font", font],
              ["w:char", character],
            ]),
            children: [],
          },
          new Set(),
        );
        if (text) mapped += 1;
        rows.push([font, character, text]);
      }
      counts.push(mapped);
    }
    expect(rows).toHaveLength(1280);
    expect(counts).toEqual([190, 223, 223, 217, 208]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1061);
    // Derived once from baseline dingbat-to-unicode 1.0.1: ordered [font, uppercase hex, output]
    // rows, including omissions, serialized with JSON.stringify and hashed as UTF-8.
    expect(createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex")).toBe(
      "ccdc785bce8ad6a1e9fc934846ae2a9185faab6a43a02ec7545d23e5669d8024",
    );
  });

  test("preserves ordinary Unicode and all five mapped fonts inside a heading", async () => {
    const value = await facts({
      body: styled(
        run("Unicode Ω ") +
          symbol("Symbol", "22") +
          symbol("Webdings", "21") +
          symbol("Wingdings", "28") +
          symbol("Wingdings 2", "21") +
          symbol("Wingdings 3", "21"),
        "Heading1",
      ),
    });
    expect(value.rawText).toBe("Unicode Ω ∀🕷🕿🖊⭠\n\n");
    expect(value.headings).toEqual([{ level: 1, text: "Unicode Ω ∀🕷🕿🖊⭠" }]);
    expect(value.hasContent).toBe(true);
  });

  test("keeps prefix casing, font aliases and permissive hex parsing distinct", async () => {
    const value = await facts({
      body: `<w:p>${run("Symbol boundary ")}${symbol("wInGdInGs", "F028")}${symbol("Wingdings", "28oops")}${symbol("Wingdings", "f028")}${symbol("Wingdings 1", "28")}${symbol(" Wingdings", "28")}${symbol("Wingdings", "zz")}${symbol("Wingdings", undefined)}</w:p>`,
    });
    expect(value.rawText).toBe("Symbol boundary 🕿🕿\n\n");
    expect(value.diagnostics).toContain("docx_symbol_unsupported");
    const outward = evidence(value);
    expect("reason" in outward).toBe(false);
    if (!("reason" in outward)) expect(outward.warnings).toEqual(["docx_metadata_unavailable"]);
  });

  test("distinguishes unmapped-only emptiness from metadata-only evidence", async () => {
    for (const title of [undefined, "Usable metadata title"]) {
      const value = await facts({
        body: `<w:p>${symbol("Unmapped", "28")}</w:p>`,
        core: title === undefined ? undefined : coreXml(title),
      });
      expect(value.rawText).toBe("\n\n");
      expect(value.headings).toEqual([]);
      expect(value.hasContent).toBe(false);
      const outward = evidence(value);
      if (title === undefined) expect(outward).toEqual({ reason: "docx_extract_error" });
      else {
        expect("reason" in outward).toBe(false);
        if (!("reason" in outward)) {
          expect(outward.titleCandidates).toEqual([title]);
          expect(outward.warnings).toContain("docx_no_lead_text");
        }
      }
    }
  });

  test("missing font remains a conversion failure despite body and metadata signals", async () => {
    for (const map of [undefined, "p.Hidden => !"]) {
      const result = await readDocxDocument(
        buildDocxPackage({
          body: styled(run("Usable body report") + symbol(undefined, "28"), "Hidden"),
          core: coreXml("Usable metadata title"),
          extraParts: map === undefined ? [] : [["mammoth/style-map", map]],
        }),
      );
      expect(result).toEqual({ ok: false, diagnostic: "docx_symbol_font_missing" });
    }
  });
});

describe("DOCX heading projection", () => {
  test("first matching embedded rule wins, invalid lines leave later/default mappings usable", async () => {
    const value = await facts({
      body: paragraph("Mapped heading", "Custom") + paragraph("Default heading", "Heading1"),
      styles: stylesXml(style("Custom", "HEADING special")),
      extraParts: [
        [
          "mammoth/style-map",
          "invalid rule\np[style-name^='heading'] => h3:fresh\np.Custom => h2:fresh",
        ],
      ],
    });
    expect(value.headings).toEqual([
      { level: 3, text: "Mapped heading" },
      { level: 1, text: "Default heading" },
    ]);
    expect(value.rawText).toBe("Mapped heading\n\nDefault heading\n\n");
    expect(value.diagnostics).toContain("docx_style_map_invalid");
  });

  for (const [target, expected] of [
    ["div > h2", "FirstSecond"],
    ["div > h2:separator(' / ')", "First / Second"],
  ] as const) {
    test(`nested non-fresh paths retain merge text for ${target}`, async () => {
      const value = await facts({
        body: paragraph("First", "Custom") + paragraph("Second", "Custom"),
        extraParts: [["mammoth/style-map", `p.Custom => ${target}`]],
      });
      expect(value.headings).toEqual([{ level: 2, text: expected }]);
      expect(value.rawText).toBe("First\n\nSecond\n\n");
    });
  }

  test("unwrapped and suppressed paragraphs preserve raw text and differ in visible content", async () => {
    const value = await facts({
      body: styled(run("Suppressed") + reference(999), "Hidden") + paragraph("Unwrapped", "Plain"),
      extraParts: [["mammoth/style-map", "p.Hidden => !\np.Plain =>"]],
    });
    expect(value.rawText).toBe("Suppressed\n\nUnwrapped\n\n");
    expect(value.headings).toEqual([]);
    expect(value.hasContent).toBe(true);
    const suppressed = await facts({
      body: paragraph("Raw survives", "Hidden"),
      extraParts: [["mammoth/style-map", "p.Hidden => !"]],
    });
    expect(suppressed.hasContent).toBe(true);
    expect(suppressed.rawText).toBe("Raw survives\n\n");
  });

  test("run and table mappings create headings in actual traversal order", async () => {
    const value = await facts({
      body: `<w:p>${run("Run heading")}</w:p><w:tbl><w:tr><w:tc>${paragraph("Table heading")}</w:tc></w:tr></w:tbl>`,
      extraParts: [["mammoth/style-map", "r => h1:fresh\ntable => h2:fresh"]],
    });
    expect(value.headings).toEqual([
      { level: 1, text: "Run heading" },
      { level: 2, text: "Table heading" },
    ]);
    expect(value.rawText).toBe("Run heading\n\nTable heading\n\n");
  });

  test("suppression inside a heading removes visible run text but preserves its raw text", async () => {
    const value = await facts({
      body: styled(
        run("Visible ") +
          '<w:r><w:rPr><w:rStyle w:val="Hidden"/></w:rPr><w:t>Hidden</w:t></w:r>' +
          run("tail"),
        "Heading1",
      ),
      extraParts: [["mammoth/style-map", "r.Hidden => !"]],
    });
    expect(value.headings).toEqual([{ level: 1, text: "Visible tail" }]);
    expect(value.rawText).toBe("Visible Hiddentail\n\n");
  });

  test("a suppressed image is not inflated while the same visible image hits its part cap", async () => {
    const image =
      '<w:r><w:drawing><wp:inline><wp:docPr id="1" name="Synthetic image"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="image"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    const options: DocxPackageOptions = {
      body: paragraph("Visible report") + styled(run("Image caption") + image, "Hidden"),
      relationships: `<Relationship Id="image" Type="${REL_NS}/image" Target="media/image.png"/>`,
      extraParts: [["word/media/image.png", Buffer.alloc(1024 * 1024 + 1)]],
    };
    const suppressed = await facts({
      ...options,
      extraParts: [...options.extraParts!, ["mammoth/style-map", "p.Hidden => !"]],
    });
    expect(suppressed.rawText).toBe("Visible report\n\nImage caption\n\n");
    expect(suppressed.hasContent).toBe(true);
    expect(await readDocxDocument(buildDocxPackage(options))).toEqual({
      ok: false,
      diagnostic: "docx_limit:maxPartDecompressedBytes",
    });
  });

  test("adjacent links reuse identical targets while distinct targets preserve heading spacing", async () => {
    for (const sameTarget of [true, false]) {
      const value = await facts({
        body: styled(
          `<w:hyperlink r:id="first">${run("<Budget &")}</w:hyperlink><w:hyperlink r:id="second">${run("Review>")}</w:hyperlink>`,
          "Heading1",
        ),
        relationships: `<Relationship Id="first" Type="${REL_NS}/hyperlink" Target="https://example.invalid/one" TargetMode="External"/><Relationship Id="second" Type="${REL_NS}/hyperlink" Target="https://example.invalid/${sameTarget ? "one" : "two"}" TargetMode="External"/>`,
      });
      expect(value.rawText).toBe("<Budget &Review>\n\n");
      expect(value.headings).toEqual([
        { level: 1, text: sameTarget ? "<Budget &Review>" : "<Budget & Review>" },
      ]);
    }
  });

  test("complex hyperlink field tags affect headings while instructions stay out of raw text", async () => {
    for (const instruction of [
      ' HYPERLINK "https://example.invalid/quoted" ',
      " HYPERLINK https://example.invalid/unquoted \\o Tooltip ",
    ]) {
      const field =
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
        `<w:r><w:instrText>${xmlEscape(instruction)}</w:instrText></w:r>` +
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
        run("Link") +
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
      const value = await facts({ body: styled(run("Before") + field + run("After"), "Heading1") });
      expect(value.rawText).toBe("BeforeLinkAfter\n\n");
      expect(value.headings).toEqual([{ level: 1, text: "Before Link After" }]);
    }
  });
});

describe("DOCX metadata selection boundaries", () => {
  test("an oversized duplicate preserves the preceding eligible metadata entry", async () => {
    const value = await facts({
      body: paragraph("Body report"),
      core: coreXml("Eligible metadata title"),
      extraParts: [["docProps/core.xml", Buffer.alloc(256 * 1024 + 1, 0x78)]],
    });
    expect("reason" in value.metadataResult).toBe(false);
    if (!("reason" in value.metadataResult))
      expect(value.metadataResult.metadata?.title).toBe("Eligible metadata title");
    const outward = evidence(value);
    expect("reason" in outward).toBe(false);
    if (!("reason" in outward)) expect(outward.titleCandidates[0]).toBe("Eligible metadata title");
  });

  test("optional metadata cannot bypass the selected XML depth guard", async () => {
    const result = await readDocxDocument(
      buildDocxPackage({
        body: paragraph("Usable body report"),
        core: `<root>${"<node>".repeat(65)}text${"</node>".repeat(65)}</root>`,
      }),
    );
    expect(result).toEqual({ ok: false, diagnostic: "docx_limit:maxXmlDepth" });
  });

  test("distinct selected XML entries sharing one path each consume the node budget", async () => {
    const bytes = buildStoredZip([
      [
        "_rels/.rels",
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="${REL_NS}/officeDocument" Target="dual.xml"/><Relationship Id="core" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="dual.xml"/></Relationships>`,
      ],
      [
        "[Content_Types].xml",
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/dual.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      ],
      ["dual.xml", coreXml("Eligible metadata title")],
      ["dual.xml", documentXml(paragraph("Visible report")) + " ".repeat(256 * 1024)],
    ]);
    // Three relationship nodes, two type nodes, five document nodes, two core nodes.
    for (const xmlElementCount of [11, 12, 13]) {
      const result = await readDocxDocument(bytes, resolveDocxLimits({ xmlElementCount }));
      if (xmlElementCount < 12)
        expect(result).toEqual({ ok: false, diagnostic: "docx_limit:xmlElementCount" });
      else {
        expect(result.ok, JSON.stringify(result)).toBe(true);
        if (result.ok) {
          expect(result.facts.rawText).toBe("Visible report\n\n");
          expect("reason" in result.facts.metadataResult).toBe(false);
          if (!("reason" in result.facts.metadataResult))
            expect(result.facts.metadataResult.metadata?.title).toBe("Eligible metadata title");
        }
      }
    }
  });
});

describe("DOCX note snapshot semantics", () => {
  test("keeps duplicate note facts after main headings before outward ranking deduplicates", async () => {
    const value = await facts({
      body:
        paragraph("Main heading", "Heading2") +
        styled(run("Body") + reference(1) + reference(1) + reference(1) + reference(2), "Plain"),
      extraParts: [
        notes(
          note(1, paragraph("Repeated heading", "Heading2")) +
            note(2, paragraph("Late heading", "Heading2")),
        ),
      ],
    });
    expect(value.headings.map((heading) => heading.text)).toEqual([
      "Main heading",
      "Repeated heading",
      "Repeated heading",
      "Repeated heading",
      "Late heading",
    ]);
    expect(value.rawText).toBe("Main heading\n\nBody\n\n");
    const outward = evidence(value);
    expect("reason" in outward).toBe(false);
    if (!("reason" in outward)) {
      expect(outward.headings).toEqual(["Main heading", "Repeated heading", "Late heading"]);
      expect(outward.titleCandidates).not.toContain("Late heading");
    }
  });

  test("reference labels affect headings while raw text excludes labels and note bodies", async () => {
    const value = await facts({
      body: styled(run("Main ") + reference(1), "Heading1"),
      extraParts: [notes(note(1, paragraph("Note heading", "Heading2")))],
    });
    expect(value.headings).toEqual([
      { level: 1, text: "Main [1]" },
      { level: 2, text: "Note heading" },
    ]);
    expect(value.rawText).toBe("Main \n\n");
  });

  for (const [id, target] of [
    ["self", 1],
    ["mutual", 2],
    ["missing", 999],
  ] as const) {
    test(`${id} nested references are labelled without recursive expansion`, async () => {
      const value = await facts({
        body: `<w:p>${reference(1)}</w:p>`,
        extraParts: [
          notes(
            note(1, styled(run("Selected note ") + reference(target), "Heading2")) +
              note(2, styled(run("Excluded note ") + reference(1), "Heading1")),
          ),
        ],
      });
      expect(value.rawText).toBe("\n\n");
      expect(value.headings).toEqual([{ level: 2, text: "Selected note [2]" }]);
      expect(value.hasContent).toBe(true);
    });
  }

  test("a missing main reference fails while a suppressed missing reference does not", async () => {
    const body = styled(run("Visible body ") + reference(999), "Hidden");
    const ordinary = await readDocxDocument(
      buildDocxPackage({ body, core: coreXml("Metadata title") }),
    );
    expect(ordinary).toEqual({ ok: false, diagnostic: "docx_note_missing" });
    const suppressed = await facts({
      body,
      core: coreXml("Metadata title"),
      extraParts: [["mammoth/style-map", "p.Hidden => !"]],
    });
    expect(suppressed.headings).toEqual([]);
    expect(suppressed.rawText).toBe("Visible body \n\n");
  });

  test("unused note bodies are still semantically validated", async () => {
    const result = await readDocxDocument(
      buildDocxPackage({
        body: paragraph("Usable body report"),
        core: coreXml("Metadata title"),
        extraParts: [notes(note(1, `<w:p>${symbol(undefined, "28")}</w:p>`))],
      }),
    );
    expect(result).toEqual({ ok: false, diagnostic: "docx_symbol_font_missing" });
  });

  test("unused notes remain selected XML subject to depth limits before projection", async () => {
    const result = await readDocxDocument(
      buildDocxPackage({
        body: paragraph("Usable body report"),
        extraParts: [
          notes(
            note(1, "<w:sdt>".repeat(65) + paragraph("Deep unused note") + "</w:sdt>".repeat(65)),
          ),
        ],
      }),
    );
    expect(result).toEqual({ ok: false, diagnostic: "docx_limit:maxXmlDepth" });
  });

  test("snapshot expansion charges repeated note content against the result budget", async () => {
    const options = {
      extraParts: [notes(note(1, paragraph("Selected note heading ".repeat(5), "Heading1")))],
    };
    const one = await facts(
      { ...options, body: `<w:p>${run("Body")}${reference(1)}</w:p>` },
      { resultBytes: 512 },
    );
    expect(one.headings).toHaveLength(1);
    const repeated = await readDocxDocument(
      buildDocxPackage({
        ...options,
        body: `<w:p>${run("Body")}${reference(1).repeat(8)}</w:p>`,
      }),
      resolveDocxLimits({ resultBytes: 512 }),
    );
    expect(repeated).toEqual({ ok: false, diagnostic: "docx_limit:resultBytes" });
  });
});

describe("DOCX list, comment and literal-filename probes", () => {
  for (const item of createAdditionalDocxContentProbes()) {
    test(item.id, async () => {
      if (!("bytes" in item.input)) throw new Error("Expected synthetic probe");
      const result = await readDocxDocument(item.input.bytes);
      if (item.expected.reason) {
        expect(result).toEqual({
          ok: false,
          diagnostic: item.id.includes("invalid-symbol")
            ? "docx_symbol_font_missing"
            : "docx_comment_missing",
        });
        return;
      }
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (!result.ok) throw new Error(result.diagnostic);
      expect(result.facts.rawText).toBe(item.expected.rawEquals!);
      const outward = evidence(result.facts);
      expect("reason" in outward).toBe(false);
      if (!("reason" in outward)) {
        expect(outward.headings ?? []).toEqual(item.expected.headings!);
        expect(outward.titleCandidates[0]).toBe(item.expected.titleFirst!);
      }
      if (item.id === "projection-comment-heading-order") {
        expect(result.facts.headings).toEqual([
          { level: 1, text: "Main report" },
          { level: 2, text: "[AB1]" },
          { level: 2, text: "[AB2]" },
          { level: 2, text: "Footnote heading" },
          { level: 3, text: "Comment heading" },
          { level: 3, text: "Comment heading" },
        ]);
      }
      if (item.id === "discovery-literal-percent-main-and-style") {
        expect(
          await readDocxDocument(
            buildDocxPackage({
              body: paragraph("Unresolved main report"),
              documentPath: "content/main part.xml",
              documentTarget: "content/main%20part.xml",
            }),
          ),
        ).toEqual({ ok: false, diagnostic: "docx_main_document_unavailable" });
      }
      if (
        item.id === "discovery-percent-style-map-ignored" ||
        item.id === "projection-utf16-style-map-invalid"
      ) {
        expect(result.facts.headings).toEqual([{ level: 1, text: item.expected.headings![0]! }]);
        if (item.id === "projection-utf16-style-map-invalid")
          expect(result.facts.diagnostics).toContain("docx_style_map_invalid");
        else expect(result.facts.diagnostics).not.toContain("docx_style_map_invalid");
      }
    });
  }
});
