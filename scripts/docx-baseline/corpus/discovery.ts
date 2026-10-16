import {
  buildDocxPackage,
  coreXml,
  documentXml,
  encodeUtf16LeXml,
  paragraph,
  style,
  stylesXml,
  WORD_NS,
} from "./builder.ts";
import type { DocxBaselineCase } from "./types.ts";

const body = paragraph("Content Discovery Report");

export function discoveryCases(): DocxBaselineCase[] {
  return [
    {
      id: "metadata-missing",
      category: "metadata-and-discovery",
      variations: ["missing-metadata"],
      input: { bytes: buildDocxPackage({ body }) },
      expected: {
        rawIncludes: ["Content Discovery Report"],
        warningsInclude: ["docx_metadata_unavailable"],
      },
    },
    {
      id: "metadata-malformed",
      category: "metadata-and-discovery",
      variations: ["malformed-metadata"],
      input: {
        bytes: buildDocxPackage({
          body,
          core: '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"><broken>',
        }),
      },
      expected: {
        rawIncludes: ["Content Discovery Report"],
        warningsInclude: ["docx_metadata_unavailable"],
      },
    },
    {
      id: "metadata-custom-path",
      category: "metadata-and-discovery",
      variations: ["non-default-metadata-path"],
      input: {
        bytes: buildDocxPackage({
          body,
          core: coreXml("Custom Core Report"),
          corePath: "metadata/custom/core.xml",
        }),
      },
      expected: { metadataTitle: "Custom Core Report", titleFirst: "Custom Core Report" },
    },
    {
      id: "metadata-utf16",
      category: "metadata-and-discovery",
      variations: ["utf16-metadata"],
      input: {
        bytes: buildDocxPackage({
          body,
          core: encodeUtf16LeXml(
            '<?xml version="1.0" encoding="UTF-16"?>' + coreXml("UTF16 核心標題"),
          ),
        }),
      },
      expected: { metadataTitle: "UTF16 核心標題", titleFirst: "UTF16 核心標題" },
    },
    {
      id: "metadata-dot-segments",
      category: "metadata-and-discovery",
      variations: ["dot-segment-metadata-target"],
      input: {
        bytes: buildDocxPackage({
          body,
          core: coreXml("Dot Segment Report"),
          corePath: "metadata/core.xml",
          coreTarget: "./metadata/old/../core.xml",
        }),
      },
      expected: { metadataTitle: "Dot Segment Report", titleFirst: "Dot Segment Report" },
    },
    {
      id: "metadata-percent-path",
      category: "metadata-and-discovery",
      variations: ["percent-escaped-metadata-path"],
      input: {
        bytes: buildDocxPackage({
          body,
          core: coreXml("Escaped Core Report"),
          corePath: "metadata/core props.xml",
          coreTarget: "metadata/core%20props.xml",
          coreContentTypePath: "metadata/core%20props.xml",
        }),
      },
      expected: { metadataTitle: "Escaped Core Report", titleFirst: "Escaped Core Report" },
    },
    {
      id: "content-custom-parts",
      category: "metadata-and-discovery",
      variations: ["non-default-main-document", "non-default-styles-part"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Custom Part Heading", "CustomHeading"),
          documentPath: "content/main.xml",
          stylesPath: "format/custom.xml",
          styles: stylesXml(style("CustomHeading", "Heading 2")),
        }),
      },
      expected: {
        rawEquals: "Custom Part Heading\n\n",
        htmlEquals: "<h2>Custom Part Heading</h2>",
        headings: ["Custom Part Heading"],
      },
    },
    {
      id: "content-dot-segment-main-target",
      category: "metadata-and-discovery",
      variations: ["dot-segment-content-target"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Resolved Part Heading", "Heading1"),
          documentPath: "content/main.xml",
          documentTarget: "content/old/../main.xml",
          stylesPath: "content/styles.xml",
          stylesTarget: "./old/../styles.xml",
          styles: stylesXml(style("Heading1", "Heading 1")),
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "content-dot-segment-style-target",
      category: "metadata-and-discovery",
      variations: ["dot-segment-style-target"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Unresolved Style Report", "CustomTop"),
          documentPath: "content/main.xml",
          stylesPath: "content/styles.xml",
          stylesTarget: "./old/../styles.xml",
          styles: stylesXml(style("CustomTop", "Heading 1")),
        }),
      },
      expected: {
        rawEquals: "Unresolved Style Report\n\n",
        htmlEquals: "<p>Unresolved Style Report</p>",
        headings: [],
      },
    },
    {
      id: "content-percent-style-target",
      category: "metadata-and-discovery",
      variations: ["percent-escaped-style-path"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Escaped Style Report", "CustomTop"),
          documentPath: "content/main.xml",
          stylesPath: "content/custom styles.xml",
          stylesTarget: "custom%20styles.xml",
          styles: stylesXml(style("CustomTop", "Heading 1")),
        }),
      },
      expected: {
        rawEquals: "Escaped Style Report\n\n",
        htmlEquals: "<p>Escaped Style Report</p>",
        headings: [],
      },
    },
    {
      id: "content-percent-main-target",
      category: "metadata-and-discovery",
      variations: ["percent-escaped-main-document-path"],
      input: {
        bytes: buildDocxPackage({
          body,
          documentPath: "content/main part.xml",
          documentTarget: "content/main%20part.xml",
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "content-alternate-prefix",
      category: "metadata-and-discovery",
      variations: ["alternate-namespace-prefix"],
      input: {
        bytes: buildDocxPackage({
          documentXml: documentXml(body)
            .replaceAll("w:", "word:")
            .replace("xmlns:w=", "xmlns:word="),
        }),
      },
      expected: {
        rawEquals: "Content Discovery Report\n\n",
        htmlEquals: "<p>Content Discovery Report</p>",
      },
    },
    {
      id: "content-strict-namespace",
      category: "metadata-and-discovery",
      variations: ["strict-wordprocessingml-namespace"],
      input: {
        bytes: buildDocxPackage({
          documentXml: documentXml(body).replaceAll(
            WORD_NS,
            "http://purl.oclc.org/ooxml/wordprocessingml/main",
          ),
        }),
      },
      expected: {
        rawEquals: "Content Discovery Report\n\n",
        htmlEquals: "<p>Content Discovery Report</p>",
      },
    },
    {
      id: "content-utf16",
      category: "metadata-and-discovery",
      variations: ["utf16-main-document"],
      input: {
        bytes: buildDocxPackage({
          documentXml: encodeUtf16LeXml(documentXml(body).replace("UTF-8", "UTF-16")),
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
  ];
}
