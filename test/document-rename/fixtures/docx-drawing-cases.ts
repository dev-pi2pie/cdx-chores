import {
  coreXml,
  documentXml,
  paragraph,
  REL_NS,
  run,
  type ZipEntry,
} from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY9sAAAAASUVORK5CYII=",
  "base64",
);
const media: ZipEntry = ["word/media/image.png", image];
const relation = (id: string, target: string | undefined, kind = "image", attributes = "") =>
  `<Relationship Id="${id}" Type="${REL_NS}/${kind}"${target === undefined ? "" : ` Target="${target}"`} ${attributes}/>`;
const imageRelation = relation("image", "media/image.png");
const linkRelation = relation("link", "https://example.invalid/drawing", "hyperlink");
const heading = (contents: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${contents}</w:p>`;
const drawing = (wrapper = "inline", click = false) =>
  `<w:r><w:drawing><wp:${wrapper}><wp:docPr id="1" name="Image">${click ? '<a:hlinkClick r:id="link"/>' : ""}</wp:docPr><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="image"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:${wrapper}></w:drawing></w:r>`;

interface DrawingCase {
  id: string;
  relationships?: string;
  click?: boolean;
  omitMedia?: boolean;
  omitted?: boolean;
  diagnostic?: string;
}

/** Authored consequences of image omission and surviving image/link tag boundaries. */
export function createDocxDrawingCases(): ReviewCase[] {
  const cases: ReviewCase[] = [];
  for (const wrapper of ["inline", "anchor"]) {
    for (const item of [
      { id: "valid" },
      { id: "missing-image-relation", relationships: "", diagnostic: "docx_initial_reader_error" },
      {
        id: "missing-image-target",
        relationships: relation("image", undefined),
        diagnostic: "docx_initial_reader_error",
      },
      { id: "empty-image-target", relationships: relation("image", ""), omitted: true },
      { id: "absent-media", omitMedia: true, omitted: true },
      { id: "missing-click-relation", click: true, diagnostic: "docx_initial_reader_error" },
      {
        id: "missing-click-target",
        click: true,
        relationships: imageRelation + relation("link", undefined, "hyperlink"),
        diagnostic: "docx_initial_reader_error",
      },
      {
        id: "empty-click-target",
        click: true,
        relationships: imageRelation + relation("link", "", "hyperlink"),
      },
      { id: "omitted-image-dangling-click", click: true, omitMedia: true, omitted: true },
    ] satisfies DrawingCase[]) {
      const itemCase: DrawingCase = item;
      const text = itemCase.omitted ? "AnnualReport" : "Annual Report";
      cases.push({
        id: `review-drawing-${wrapper}-${item.id}`,
        options: {
          body: heading(run("Annual") + drawing(wrapper, itemCase.click) + run("Report")),
          relationships: itemCase.relationships ?? imageRelation,
          extraParts: itemCase.omitMedia ? [] : [media],
        },
        rawText: "AnnualReport\n\n",
        headings: [{ level: 1, text }],
        titleCandidates: [...new Set([text, "AnnualReport"])],
        diagnostic: itemCase.diagnostic,
      });
    }
  }

  for (const item of [
    {
      id: "duplicate-image-missing",
      relationships: imageRelation + relation("image", undefined),
      diagnostic: "docx_initial_reader_error",
    },
    {
      id: "duplicate-image-empty",
      relationships: imageRelation + relation("image", ""),
      omitted: true,
    },
    {
      id: "duplicate-image-absent",
      relationships: imageRelation + relation("image", "media/absent.png"),
      omitted: true,
    },
    { id: "duplicate-image-restored", relationships: relation("image", undefined) + imageRelation },
    {
      id: "duplicate-click-missing",
      click: true,
      relationships: imageRelation + linkRelation + relation("link", undefined, "hyperlink"),
      diagnostic: "docx_initial_reader_error",
    },
    {
      id: "duplicate-click-empty",
      click: true,
      relationships: imageRelation + linkRelation + relation("link", "", "hyperlink"),
    },
    {
      id: "duplicate-click-restored",
      click: true,
      relationships: imageRelation + relation("link", undefined, "hyperlink") + linkRelation,
    },
    { id: "embed-other-type", relationships: relation("image", "media/image.png", "custom") },
    {
      id: "embed-external-mode-internal-media",
      relationships: relation("image", "media/image.png", "image", 'TargetMode="External"'),
    },
  ] satisfies DrawingCase[]) {
    const itemCase: DrawingCase = item;
    const text = itemCase.omitted ? "AnnualReport" : "Annual Report";
    cases.push({
      id: `review-drawing-${item.id}`,
      options: {
        body: heading(run("Annual") + drawing("inline", itemCase.click) + run("Report")),
        relationships: item.relationships,
        extraParts: [media],
      },
      rawText: "AnnualReport\n\n",
      headings: [{ level: 1, text }],
      titleCandidates: [...new Set([text, "AnnualReport"])],
      diagnostic: itemCase.diagnostic,
    });
  }

  for (const missingImage of [true, false]) {
    cases.push({
      id: `review-drawing-suppressed-${missingImage ? "image" : "click"}`,
      options: {
        body: heading(run("Annual") + drawing("inline", !missingImage) + run("Report")),
        relationships: missingImage ? "" : imageRelation,
        core: missingImage ? coreXml("Usable metadata title") : undefined,
        extraParts: [media, ["mammoth/style-map", "p.Heading1 => !"]],
      },
      rawText: "AnnualReport\n\n",
      headings: [],
      titleCandidates: ["AnnualReport"],
      diagnostic: missingImage ? "docx_initial_reader_error" : undefined,
    });
  }

  for (const kind of ["footnote", "endnote", "comment"]) {
    for (const referenced of [false, true]) {
      for (const missingImage of [true, false]) {
        const reference = `<w:r><w:${kind}Reference w:id="1"/></w:r>`;
        const contents = `<w:${kind} w:id="1">${heading(run("Annual") + drawing("anchor", !missingImage) + run("Report"))}</w:${kind}>`;
        const part = documentXml(contents)
          .replaceAll("w:document", `w:${kind}s`)
          .replace("<w:body>", "")
          .replace("</w:body>", "");
        const sourceRelationships = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${missingImage ? relation("image", undefined) : imageRelation}</Relationships>`;
        const fails = missingImage || referenced;
        cases.push({
          id: `review-drawing-${kind}-${referenced ? "referenced" : "unused"}-${missingImage ? "image" : "click"}`,
          options: {
            body:
              paragraph("Main report", "Heading1") + (referenced ? `<w:p>${reference}</w:p>` : ""),
            relationships: imageRelation + linkRelation,
            extraParts: [
              media,
              [`word/${kind}s.xml`, part],
              [`word/_rels/${kind}s.xml.rels`, sourceRelationships],
              ...(kind === "comment"
                ? [["mammoth/style-map", "comment-reference => sup"] satisfies ZipEntry]
                : []),
            ],
          },
          rawText: `Main report\n\n${referenced ? "\n\n" : ""}`,
          headings: [{ level: 1, text: "Main report" }],
          diagnostic: fails ? "docx_initial_reader_error" : undefined,
        });
      }
    }
    const part = documentXml(
      `<w:${kind} w:id="1">${heading(run("Annual") + drawing("anchor", true) + run("Report"))}</w:${kind}>`,
    )
      .replaceAll("w:document", `w:${kind}s`)
      .replace("<w:body>", "")
      .replace("</w:body>", "");
    cases.push({
      id: `review-drawing-${kind}-source-targets`,
      options: {
        body:
          paragraph("Main report", "Heading1") +
          `<w:p><w:r><w:${kind}Reference w:id="1"/></w:r></w:p>`,
        relationships: relation("image", undefined) + relation("link", undefined, "hyperlink"),
        extraParts: [
          media,
          [`word/${kind}s.xml`, part],
          [
            `word/_rels/${kind}s.xml.rels`,
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${imageRelation + linkRelation}</Relationships>`,
          ],
          ...(kind === "comment"
            ? [["mammoth/style-map", "comment-reference => sup"] satisfies ZipEntry]
            : []),
        ],
      },
      rawText: "Main report\n\n\n\n",
      headings: [
        { level: 1, text: "Main report" },
        { level: 1, text: "Annual Report" },
      ],
    });
  }

  for (const target of [undefined, "", "no-id"]) {
    cases.push({
      id: `review-drawing-vml-${target === undefined ? "missing-target" : target === "" ? "empty-target" : target}`,
      options: {
        body:
          paragraph("Main report", "Heading1") +
          `<w:p><w:r><w:pict><v:shape><v:imagedata${target === "no-id" ? "" : ' r:id="image"'}/></v:shape></w:pict></w:r></w:p>`,
        relationships: relation("image", target),
      },
      rawText: "Main report\n\n\n\n",
      headings: [{ level: 1, text: "Main report" }],
      diagnostic: target === undefined ? "docx_initial_reader_error" : undefined,
    });
  }
  for (const [id, contents, relationships] of [
    ["bare-blip-ignored", '<w:r><a:blip r:embed="missing"/></w:r>', ""],
    [
      "outside-picture-path-ignored",
      '<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><a:blip r:embed="missing"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>',
      "",
    ],
    [
      "external-image-omitted",
      drawing("inline", true).replace('r:embed="image"', 'r:link="image"'),
      relation("image", "https://example.invalid/image.png", "image", 'TargetMode="External"'),
    ],
  ]) {
    cases.push({
      id: `review-drawing-${id}`,
      options: { body: heading(run("Annual") + contents + run("Report")), relationships },
      rawText: "AnnualReport\n\n",
      headings: [{ level: 1, text: "AnnualReport" }],
    });
  }
  return cases;
}
