import { describe, expect, test } from "bun:test";

import { readDocxCoreMetadataFromParts } from "../../../src/adapters/docx/ooxml-metadata";
import { resolveDocxMetadataPartPaths } from "../../../src/adapters/docx/ooxml-part-discovery";
import { coreXml } from "../../document-rename/fixtures/docx-baseline/corpus/builder";

const CORE_TYPE = "application/vnd.openxmlformats-package.core-properties+xml";
const APP_TYPE = "application/vnd.openxmlformats-officedocument.extended-properties+xml";
const application = (name: string) => `<Properties><Application>${name}</Application></Properties>`;

function parts(): Map<string, string> {
  return new Map([
    ["/docProps/core.xml", coreXml("Fallback title")],
    ["/docProps/app.xml", application("Fallback writer")],
    ["/custom/core.xml", coreXml("Ignored title")],
    ["/custom/app.xml", application("Ignored writer")],
  ]);
}

describe("OOXML validation fallback", () => {
  test("newly invalid relationships cannot select alternate metadata parts", () => {
    const input = parts();
    input.set(
      "/_rels/.rels",
      '<Relationships value="\u0001"><Relationship Target="custom/core.xml"/><Relationship Target="custom/app.xml"/></Relationships>',
    );
    input.set("/[Content_Types].xml", "<Types/>");
    expect(resolveDocxMetadataPartPaths(input)).toEqual({
      corePropertiesPath: "/docProps/core.xml",
      appPropertiesPath: "/docProps/app.xml",
    });
    expect(readDocxCoreMetadataFromParts(input)).toEqual({
      metadata: { title: "Fallback title", application: "Fallback writer" },
      warnings: [],
    });
  });

  test("newly invalid content types fall back to valid relationship targets", () => {
    const input = parts();
    input.set("/selected/core.xml", coreXml("Selected title"));
    input.set("/selected/app.xml", application("Selected writer"));
    input.set(
      "/_rels/.rels",
      '<Relationships><Relationship Target="selected/core.xml"/><Relationship Target="selected/app.xml"/></Relationships>',
    );
    input.set(
      "/[Content_Types].xml",
      `<Types xmlns:w=""><Override PartName="/custom/core.xml" ContentType="${CORE_TYPE}"/><Override PartName="/custom/app.xml" ContentType="${APP_TYPE}"/></Types>`,
    );
    expect(resolveDocxMetadataPartPaths(input)).toEqual({
      corePropertiesPath: "/selected/core.xml",
      appPropertiesPath: "/selected/app.xml",
    });
    expect(readDocxCoreMetadataFromParts(input)).toEqual({
      metadata: { title: "Selected title", application: "Selected writer" },
      warnings: [],
    });
  });

  test("invalid optional properties stay unavailable and valid later calls still work", () => {
    const input = parts();
    input.delete("/custom/core.xml");
    input.delete("/custom/app.xml");
    input.set("/docProps/core.xml", coreXml("Invalid\u0001title"));
    expect(readDocxCoreMetadataFromParts(input)).toEqual({
      warnings: ["docx_metadata_unavailable"],
    });
    input.set("/docProps/core.xml", coreXml("Recovered title"));
    input.set("/docProps/app.xml", application("Invalid\u0001writer"));
    expect(readDocxCoreMetadataFromParts(input)).toEqual({
      metadata: { title: "Recovered title" },
      warnings: [],
    });
    input.set("/docProps/app.xml", application("Recovered writer"));
    expect(readDocxCoreMetadataFromParts(input)).toEqual({
      metadata: { title: "Recovered title", application: "Recovered writer" },
      warnings: [],
    });
  });
});
