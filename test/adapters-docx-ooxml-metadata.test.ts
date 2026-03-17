import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readDocxCoreMetadata } from "../src/adapters/docx/ooxml-metadata";
import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";

const FIXTURE_TIMESTAMP = new Date("2026-03-17T00:00:00.000Z");

function xmlEscape(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let round = 0; round < 8; round += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    const tableEntry = CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableEntry ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function buildStoredZip(entries: Array<[string, string | Buffer]>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { date, time } = toDosDateTime(FIXTURE_TIMESTAMP);

  for (const [fileName, rawContent] of entries) {
    const fileNameBuffer = Buffer.from(fileName, "utf8");
    const contentBuffer = Buffer.isBuffer(rawContent)
      ? rawContent
      : Buffer.from(rawContent, "utf8");
    const checksum = crc32(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuffer, contentBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileNameBuffer);
    offset += localHeader.length + fileNameBuffer.length + contentBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function buildDocxPackage(options: {
  appXml?: string;
  appXmlPath?: string;
  coreXml?: string;
  coreXmlPath?: string;
  includeCoreRelationship?: boolean;
}): Buffer {
  const entries: Array<[string, string | Buffer]> = [];
  const appXmlPath = options.appXmlPath ?? "docProps/app.xml";
  const coreXmlPath = options.coreXmlPath ?? "docProps/core.xml";
  const relationships = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
  ];

  if (options.includeCoreRelationship !== false) {
    relationships.push(
      `<Relationship Id="rId2" Type="unused-in-helper" Target="${coreXmlPath}"/>`,
    );
  }
  if (options.appXml) {
    relationships.push(
      `<Relationship Id="rId3" Type="unused-in-helper" Target="${appXmlPath}"/>`,
    );
  }

  entries.push([
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${options.coreXml ? `<Override PartName="/${coreXmlPath}" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` : ""}${options.appXml ? `<Override PartName="/${appXmlPath}" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` : ""}</Types>`,
  ]);
  entries.push([
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`,
  ]);
  entries.push([
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">Body text</w:t></w:r></w:p></w:body></w:document>',
  ]);

  if (options.coreXml) {
    entries.push([coreXmlPath, options.coreXml]);
  }
  if (options.appXml) {
    entries.push([appXmlPath, options.appXml]);
  }

  return buildStoredZip(entries.sort(([left], [right]) => left.localeCompare(right)));
}

describe("docx OOXML metadata helper", () => {
  test("does not attempt runtime fetch for OOXML relationship identifiers", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "metadata-rich.docx");
    const originalFetch = globalThis.fetch;
    let fetchCallCount = 0;

    globalThis.fetch = (async (..._args: Parameters<typeof fetch>) => {
      fetchCallCount += 1;
      throw new Error("DOCX metadata helper should not fetch network resources.");
    }) as unknown as typeof fetch;

    try {
      const result = await readDocxCoreMetadata(fixturePath);

      expect("reason" in result).toBe(false);
      expect(fetchCallCount).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("reads core metadata from the metadata-rich fixture", async () => {
    const fixturePath = join(REPO_ROOT, "test", "fixtures", "docs", "metadata-rich.docx");

    const result = await readDocxCoreMetadata(fixturePath);

    expect("reason" in result).toBe(false);
    if ("reason" in result) {
      throw new Error("Expected metadata result");
    }

    expect(result.warnings).toEqual([]);
    expect(result.metadata).toEqual({
      application: "Microsoft Office Word",
      created: "2026-03-17T00:00:00Z",
      creator: "Fixture Generator",
      description:
        "Deterministic DOCX fixture with weak heading text and stronger metadata title.",
      lastModifiedBy: "Fixture Generator",
      modified: "2026-03-17T00:00:00Z",
      subject: "DOCX metadata extraction fixture",
      title: "Quarterly Operating Plan 2026",
    });
  });

  test("reads metadata from non-default part locations without relationship-type URI matching", async () => {
    await withTempFixtureDir("docx-metadata", async (fixtureDir) => {
      const docxPath = join(fixtureDir, "custom-parts.docx");
      await writeFile(
        docxPath,
        buildDocxPackage({
          appXml:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LibreOffice Writer</Application></Properties>',
          appXmlPath: "metadata/extended/app-props.xml",
          coreXml:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Custom metadata path</dc:title><dc:creator>Fixture Generator</dc:creator></cp:coreProperties>',
          coreXmlPath: "metadata/core/custom-core.xml",
        }),
      );

      const result = await readDocxCoreMetadata(docxPath);

      expect("reason" in result).toBe(false);
      if ("reason" in result) {
        throw new Error("Expected metadata result");
      }

      expect(result.warnings).toEqual([]);
      expect(result.metadata?.title).toBe("Custom metadata path");
      expect(result.metadata?.creator).toBe("Fixture Generator");
      expect(result.metadata?.application).toBe("LibreOffice Writer");
    });
  });

  test("returns docx_metadata_unavailable when core properties are missing", async () => {
    await withTempFixtureDir("docx-metadata", async (fixtureDir) => {
      const docxPath = join(fixtureDir, "missing-core.docx");
      await writeFile(
        docxPath,
        buildDocxPackage({
          appXml:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Writer</Application></Properties>',
          includeCoreRelationship: false,
        }),
      );

      const result = await readDocxCoreMetadata(docxPath);

      expect(result).toEqual({ warnings: ["docx_metadata_unavailable"] });
    });
  });

  test("returns docx_metadata_unavailable when core properties XML is malformed", async () => {
    await withTempFixtureDir("docx-metadata", async (fixtureDir) => {
      const docxPath = join(fixtureDir, "malformed-core.docx");
      await writeFile(
        docxPath,
        buildDocxPackage({
          coreXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEscape("Broken title")}`,
        }),
      );

      const result = await readDocxCoreMetadata(docxPath);

      expect(result).toEqual({ warnings: ["docx_metadata_unavailable"] });
    });
  });

  test("returns docx_extract_error for invalid zip bytes", async () => {
    await withTempFixtureDir("docx-metadata", async (fixtureDir) => {
      const brokenDir = join(fixtureDir, "broken-zip");
      await mkdir(brokenDir, { recursive: true });
      const docxPath = join(brokenDir, "broken.docx");
      await writeFile(docxPath, "not-a-real-docx", "utf8");

      const result = await readDocxCoreMetadata(docxPath);

      expect(result).toEqual({ reason: "docx_extract_error" });
    });
  });
});
