import { buildDocxPackage, coreXml, documentXml, paragraph, REL_NS, run } from "./builder.ts";
import type { DocxBaselineCase } from "./types.ts";

// A one-pixel PNG is embedded only to exercise binary-part conversion, never OCR.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);

function image(relationshipId: string, external = false): string {
  return `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Synthetic image"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:${external ? "link" : "embed"}="${relationshipId}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export function boundaryCases(): DocxBaselineCase[] {
  return [
    {
      id: "empty-valid",
      category: "empty-and-non-text",
      variations: ["valid-empty-document"],
      input: { bytes: buildDocxPackage() },
      expected: { rawEquals: "", htmlEquals: "", reason: "docx_extract_error" },
    },
    {
      id: "empty-image-only",
      category: "empty-and-non-text",
      variations: ["image-only", "binary-image-part"],
      input: {
        bytes: buildDocxPackage({
          body: image("picture"),
          relationships: `<Relationship Id="picture" Type="${REL_NS}/image" Target="media/image.png"/>`,
          extraParts: [["word/media/image.png", PNG]],
        }),
      },
      expected: {
        rawEquals: "\n\n",
        htmlIncludes: ['<img src="data:image/png;base64,'],
        reason: "docx_no_title_signal",
      },
    },
    {
      id: "empty-table-only",
      category: "empty-and-non-text",
      variations: ["empty-table"],
      input: {
        bytes: buildDocxPackage({ body: "<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>" }),
      },
      expected: {
        rawEquals: "\n\n",
        htmlEquals: "<table><tr><td></td></tr></table>",
        reason: "docx_no_title_signal",
      },
    },
    {
      id: "empty-line-break-only",
      category: "empty-and-non-text",
      variations: ["line-break-only"],
      input: { bytes: buildDocxPackage({ body: "<w:p><w:r><w:br/></w:r></w:p>" }) },
      expected: { rawEquals: "\n\n", htmlEquals: "<p><br /></p>", reason: "docx_no_title_signal" },
    },
    {
      id: "metadata-title-only",
      category: "metadata-only-evidence",
      variations: ["usable-title-empty-body", "successful-empty-conversion"],
      input: { bytes: buildDocxPackage({ core: coreXml("Metadata Only Report") }) },
      expected: {
        rawEquals: "",
        htmlEquals: "",
        titleFirst: "Metadata Only Report",
        metadataTitle: "Metadata Only Report",
        warningsInclude: ["docx_no_lead_text"],
      },
    },
    {
      id: "metadata-author-only",
      category: "metadata-only-evidence",
      variations: ["author-only-empty-body"],
      input: { bytes: buildDocxPackage({ core: coreXml(undefined, "Synthetic Author") }) },
      expected: { rawEquals: "", htmlEquals: "", reason: "docx_extract_error" },
    },
    {
      id: "metadata-conversion-failure",
      category: "metadata-only-evidence",
      variations: ["available-title-conversion-failure"],
      input: {
        bytes: buildDocxPackage({
          core: coreXml("Unavailable After Failure Report"),
          documentXml:
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
        }),
      },
      expected: { metadataTitle: "Unavailable After Failure Report", reason: "docx_extract_error" },
    },
    {
      id: "partial-unsupported-content",
      category: "partial-and-malformed",
      variations: ["usable-text-with-unsupported-content", "unsupported-content-excluded"],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Supported Body Report") +
            `<w:unknownElement>${run("Unsupported Excluded Text")}</w:unknownElement>` +
            paragraph("After Unsupported"),
        }),
      },
      expected: {
        rawOrdered: ["Supported Body Report", "After Unsupported"],
        rawExcludes: ["Unsupported Excluded Text"],
        htmlExcludes: ["Unsupported Excluded Text"],
        titleFirst: "Supported Body Report",
      },
    },
    {
      id: "malformed-invalid-zip",
      category: "partial-and-malformed",
      variations: ["invalid-zip"],
      input: { bytes: Buffer.from("not-a-real-docx") },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-main-xml",
      category: "partial-and-malformed",
      variations: ["invalid-main-xml"],
      input: {
        bytes: buildDocxPackage({
          documentXml: documentXml(paragraph("Broken XML Report")).replace("</w:body>", "</wrong>"),
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-missing-main",
      category: "partial-and-malformed",
      variations: ["missing-main-part"],
      input: { bytes: buildDocxPackage({ omit: ["word/document.xml"] }) },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-invalid-styles",
      category: "partial-and-malformed",
      variations: ["invalid-styles-part"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Valid Text Before Invalid Styles"),
          styles: "<w:styles><broken>",
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-missing-styles",
      category: "partial-and-malformed",
      variations: ["missing-styles-part"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Missing Styles Report", "Heading1"),
          relationships: `<Relationship Id="missing-styles" Type="${REL_NS}/styles" Target="missing.xml"/>`,
        }),
      },
      expected: {
        rawEquals: "Missing Styles Report\n\n",
        htmlEquals: "<h1>Missing Styles Report</h1>",
        headings: ["Missing Styles Report"],
      },
    },
    {
      id: "malformed-invalid-package-relationships",
      category: "partial-and-malformed",
      variations: ["invalid-package-relationships"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Unavailable Relationship Report"),
          replaceParts: [["_rels/.rels", "<Relationships><broken>"]],
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-invalid-content-types",
      category: "partial-and-malformed",
      variations: ["invalid-content-types-part"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Unavailable Content Types Report"),
          replaceParts: [["[Content_Types].xml", "<Types><broken>"]],
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-invalid-document-relationships",
      category: "partial-and-malformed",
      variations: ["invalid-main-relationships-part"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Unavailable Main Relationships Report"),
          replaceParts: [["word/_rels/document.xml.rels", "<Relationships><broken>"]],
        }),
      },
      expected: { reason: "docx_extract_error" },
    },
    {
      id: "malformed-missing-content-types",
      category: "partial-and-malformed",
      variations: ["missing-content-types-part", "permissive-content-types-fallback"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Missing Content Types Report"),
          omit: ["[Content_Types].xml"],
        }),
      },
      expected: {
        rawEquals: "Missing Content Types Report\n\n",
        titleFirst: "Missing Content Types Report",
        warningsInclude: ["docx_metadata_unavailable"],
      },
    },
    {
      id: "malformed-missing-package-relationships",
      category: "partial-and-malformed",
      variations: ["missing-package-relationships-part", "default-main-document-fallback"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Missing Package Relationships Report"),
          omit: ["_rels/.rels"],
        }),
      },
      expected: {
        rawEquals: "Missing Package Relationships Report\n\n",
        titleFirst: "Missing Package Relationships Report",
      },
    },
    {
      id: "malformed-duplicate-normalized-parts",
      category: "partial-and-malformed",
      variations: ["duplicate-normalized-part-name"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("First Duplicate Report"),
          core: coreXml("Metadata With Duplicate Part"),
          extraParts: [["word/./document.xml", documentXml(paragraph("Second Duplicate Report"))]],
        }),
      },
      expected: {
        rawIncludes: ["Second Duplicate Report"],
        rawExcludes: ["First Duplicate Report"],
        metadataTitle: "Metadata With Duplicate Part",
        titleFirst: "Metadata With Duplicate Part",
      },
    },
    ...[
      { kind: "url", target: "https://example.invalid/never-load.png" },
      { kind: "file", target: "file:///docx-baseline-synthetic-never-load.png" },
    ].map(({ kind, target }): DocxBaselineCase => ({
      id: `offline-external-${kind}`,
      category: "resource-and-io",
      variations: [
        `external-${kind}-relationship`,
        `external-${kind}-image-disabled`,
        `external-${kind}-hyperlink-preserved`,
      ],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Offline Resource Report") +
            image("external-image", true) +
            `<w:p><w:hyperlink r:id="external-link">${run("External Link Label")}</w:hyperlink></w:p>`,
          relationships: `<Relationship Id="external-image" Type="${REL_NS}/image" Target="${target}" TargetMode="External"/><Relationship Id="external-link" Type="${REL_NS}/hyperlink" Target="${target}" TargetMode="External"/>`,
        }),
      },
      expected: {
        rawOrdered: ["Offline Resource Report", "External Link Label"],
        rawExcludes: [target],
        htmlIncludes: [`<a href="${target}">External Link Label</a>`],
        htmlExcludes: ["<img"],
        titleFirst: "Offline Resource Report",
      },
    })),
    {
      id: "offline-executable-embedded-parts",
      category: "resource-and-io",
      variations: ["embedded-object-content", "macro-content", "executable-content-not-evaluated"],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Embedded Object Report") +
            '<w:p><w:r><w:object><o:OLEObject xmlns:o="urn:schemas-microsoft-com:office:office" Type="Embed" ProgID="Synthetic.Script" r:id="object"/></w:object></w:r></w:p>',
          relationships: `<Relationship Id="object" Type="${REL_NS}/oleObject" Target="embeddings/synthetic.js"/>`,
          extraParts: [
            ["word/embeddings/synthetic.js", 'throw new Error("DOCX_BASELINE_EXECUTED");'],
            ["word/vbaProject.bin", Buffer.from("DOCX_BASELINE_MACRO_SENTINEL")],
          ],
        }),
      },
      expected: {
        rawIncludes: ["Embedded Object Report"],
        rawExcludes: ["DOCX_BASELINE_EXECUTED", "DOCX_BASELINE_MACRO_SENTINEL"],
        htmlExcludes: ["DOCX_BASELINE_EXECUTED", "DOCX_BASELINE_MACRO_SENTINEL"],
        titleFirst: "Embedded Object Report",
      },
    },
  ];
}
