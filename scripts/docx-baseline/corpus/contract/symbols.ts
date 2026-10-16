import { buildDocxPackage, coreXml, run, style, stylesXml, xmlEscape } from "../builder.ts";
import type { DocxBaselineCase } from "../types.ts";

function symbol(font?: string, char?: string): string {
  return `<w:r><w:sym${font === undefined ? "" : ` w:font="${xmlEscape(font)}"`}${char === undefined ? "" : ` w:char="${xmlEscape(char)}"`}/></w:r>`;
}

function symbolCase(
  id: string,
  variations: string[],
  body: string,
  expected: DocxBaselineCase["expected"],
  core?: string,
): DocxBaselineCase {
  return {
    id: `contract-symbol-${id}`,
    category: "contract-symbols",
    variations,
    input: { bytes: buildDocxPackage({ body, core }) },
    expected,
  };
}

export function contractSymbolCases(): DocxBaselineCase[] {
  const unsupported = "A w:sym element with an unsupported character was ignored";
  return [
    symbolCase(
      "font-matrix",
      ["symbol", "webdings", "wingdings", "wingdings-2", "wingdings-3", "astral-unicode"],
      `<w:p>${run("Font Matrix Report ")}${symbol("Symbol", "22")}${symbol("Webdings", "21")}${symbol("Wingdings", "28")}${symbol("Wingdings 2", "21")}${symbol("Wingdings 3", "21")}</w:p>`,
      {
        rawEquals: "Font Matrix Report ∀🕷🕿🖊⭠\n\n",
        htmlEquals: "<p>Font Matrix Report ∀🕷🕿🖊⭠</p>",
        titleFirst: "Font Matrix Report ∀🕷🕿🖊⭠",
      },
    ),
    symbolCase(
      "case-and-prefix",
      ["case-insensitive-font", "uppercase-f0-prefix", "lowercase-f0-prefix-unmapped"],
      `<w:p>${run("Prefix Report ")}${symbol("wInGdInGs", "28")}${symbol("Wingdings", "F028")}${symbol("Wingdings", "f028")}</w:p>`,
      {
        rawEquals: "Prefix Report 🕿🕿\n\n",
        htmlEquals: "<p>Prefix Report 🕿🕿</p>",
        htmlMessagesInclude: [`${unsupported}: char f028 in font Wingdings`],
        rawMessagesInclude: [`${unsupported}: char f028 in font Wingdings`],
      },
    ),
    symbolCase(
      "unknown-body",
      ["unknown-font", "unknown-code", "wingdings-1-is-not-an-alias", "body-preserved"],
      `<w:p>${run("Before Unknown ")}${symbol("Unmapped Font", "28")}${symbol("Wingdings", "0000")}${symbol("Wingdings 1", "28")}${run("After Unknown")}</w:p>`,
      {
        rawEquals: "Before Unknown After Unknown\n\n",
        htmlEquals: "<p>Before Unknown After Unknown</p>",
        htmlMessagesInclude: [
          "char 28 in font Unmapped Font",
          "char 0000 in font Wingdings",
          "char 28 in font Wingdings 1",
        ],
        warningsInclude: ["docx_metadata_unavailable"],
      },
    ),
    symbolCase(
      "unknown-only",
      ["unsupported-only", "empty-after-omission"],
      `<w:p>${symbol("Unmapped Font", "28")}</w:p>`,
      {
        rawEquals: "\n\n",
        htmlEquals: "",
        htmlMessagesInclude: [unsupported],
        reason: "docx_extract_error",
      },
    ),
    symbolCase(
      "unknown-metadata",
      ["unsupported-only", "metadata-only-evidence"],
      `<w:p>${symbol("Unmapped Font", "28")}</w:p>`,
      {
        rawEquals: "\n\n",
        htmlEquals: "",
        metadataTitle: "Metadata Symbol Report",
        titleFirst: "Metadata Symbol Report",
        warningsInclude: ["docx_no_lead_text"],
      },
      coreXml("Metadata Symbol Report"),
    ),
    symbolCase(
      "missing-char",
      ["missing-character-attribute", "warning-and-omission"],
      `<w:p>${run("Missing Character Report ")}${symbol("Wingdings")}</w:p>`,
      {
        rawEquals: "Missing Character Report \n\n",
        htmlEquals: "<p>Missing Character Report </p>",
        htmlMessagesInclude: ["char undefined in font Wingdings"],
      },
    ),
    symbolCase(
      "malformed-char",
      ["invalid-hex-omitted", "partial-hex-parsed"],
      `<w:p>${run("Malformed Character Report ")}${symbol("Wingdings", "zz")}${symbol("Wingdings", "28oops")}</w:p>`,
      {
        rawEquals: "Malformed Character Report 🕿\n\n",
        htmlEquals: "<p>Malformed Character Report 🕿</p>",
        htmlMessagesInclude: ["char zz in font Wingdings"],
      },
    ),
    symbolCase(
      "missing-font",
      ["missing-font-attribute", "converter-error"],
      `<w:p>${run("Before Missing Font")}${symbol(undefined, "28")}</w:p>`,
      {
        htmlErrorIncludes: "toUpperCase",
        rawErrorIncludes: "toUpperCase",
        reason: "docx_extract_error",
      },
    ),
    {
      id: "contract-symbol-heading",
      category: "contract-symbols",
      variations: ["mapped-heading-symbol", "heading-rank-and-prompt"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run("Symbol Heading Report ")}${symbol("Symbol", "22")}</w:p>`,
          styles: stylesXml(style("Heading1", "Heading 1")),
        }),
      },
      expected: {
        rawEquals: "Symbol Heading Report ∀\n\n",
        htmlEquals: "<h1>Symbol Heading Report ∀</h1>",
        headings: ["Symbol Heading Report ∀"],
        titleFirst: "Symbol Heading Report ∀",
      },
    },
    symbolCase(
      "mapped-only",
      ["symbol-only-signal", "mapped-unicode-evidence"],
      `<w:p>${symbol("Symbol", "22")}</w:p>`,
      { rawEquals: "∀\n\n", htmlEquals: "<p>∀</p>", titleFirst: "∀" },
    ),
    symbolCase(
      "missing-font-metadata",
      ["missing-font-attribute", "metadata-does-not-rescue-conversion-error"],
      `<w:p>${symbol(undefined, "28")}</w:p>`,
      {
        metadataTitle: "Metadata With Invalid Symbol",
        htmlErrorIncludes: "toUpperCase",
        rawErrorIncludes: "toUpperCase",
        reason: "docx_extract_error",
      },
      coreXml("Metadata With Invalid Symbol"),
    ),
  ];
}
