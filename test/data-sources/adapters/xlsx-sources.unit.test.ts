import { describe, expect, test } from "bun:test";

import { writeFile } from "node:fs/promises";

import { join } from "node:path";

import { collectXlsxSheetSnapshot, listXlsxSheetNames } from "../../../src/cli/duckdb/xlsx-sources";
import { expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";

function createWorkbookWithInvalidCentralDirectoryOffset(): Buffer {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt32LE(0x000f423f, 12);
  buffer.writeUInt32LE(0x000f423f, 16);
  return buffer;
}

function writeZipNameAndData(header: Buffer, fileName: string, data: Buffer): Buffer {
  return Buffer.concat([header, Buffer.from(fileName, "utf8"), data]);
}

function createStoredZip(
  entries: Array<{ fileName: string; data: string; method?: number }>,
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const data = Buffer.from(entry.data, "utf8");
    const method = entry.method ?? 0;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localParts.push(writeZipNameAndData(localHeader, entry.fileName, data));

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(writeZipNameAndData(centralHeader, entry.fileName, Buffer.alloc(0)));

    localOffset += 30 + fileName.length + data.length;
  }

  const centralDirectoryOffset = localOffset;
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function createWorkbookWithMalformedCentralDirectory(): Buffer {
  const centralDirectory = Buffer.from("not-central");
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([centralDirectory, eocd]);
}

function createWorkbookWithMalformedLocalHeader(): Buffer {
  const workbook = createStoredZip([
    {
      fileName: "xl/workbook.xml",
      data: '<workbook><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
  ]);
  workbook.writeUInt32LE(0, 0);
  return workbook;
}

describe("xlsx source discovery", () => {
  test("collectXlsxSheetSnapshot summarizes non-empty rows and used range for a simple workbook", async () => {
    const snapshot = await collectXlsxSheetSnapshot(
      "test/data-sources/fixtures/multi.xlsx",
      "Summary",
    );

    expect(snapshot.sheetName).toBe("Summary");
    expect(snapshot.usedRange).toBe("A1:C3");
    expect(snapshot.nonEmptyRowCount).toBe(3);
    expect(snapshot.rows[0]).toEqual({
      cellCount: 3,
      cells: [
        { ref: "A1", value: "id" },
        { ref: "B1", value: "name" },
        { ref: "C1", value: "status" },
      ],
      firstRef: "A1",
      lastRef: "C1",
      rowNumber: 1,
    });
  });

  test("listXlsxSheetNames converts corrupt zip offsets into CliError", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "broken.xlsx");
      await writeFile(workbookPath, createWorkbookWithInvalidCentralDirectoryOffset());

      await expectCliError(() => listXlsxSheetNames(workbookPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "failed to read workbook metadata",
      });
    });
  });

  test("listXlsxSheetNames reports malformed central-directory records", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "malformed-central-directory.xlsx");
      await writeFile(workbookPath, createWorkbookWithMalformedCentralDirectory());

      await expectCliError(() => listXlsxSheetNames(workbookPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "malformed ZIP central directory",
      });
    });
  });

  test("listXlsxSheetNames reports malformed local headers", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "malformed-local-header.xlsx");
      await writeFile(workbookPath, createWorkbookWithMalformedLocalHeader());

      await expectCliError(() => listXlsxSheetNames(workbookPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "malformed ZIP local header",
      });
    });
  });

  test("collectXlsxSheetSnapshot reports malformed ZIP metadata from the snapshot path", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "snapshot-malformed-local-header.xlsx");
      await writeFile(workbookPath, createWorkbookWithMalformedLocalHeader());

      await expectCliError(() => collectXlsxSheetSnapshot(workbookPath, "Summary"), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "malformed ZIP local header",
      });
    });
  });

  test("listXlsxSheetNames reports unsupported ZIP compression methods", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "unsupported-compression.xlsx");
      await writeFile(
        workbookPath,
        createStoredZip([
          {
            fileName: "xl/workbook.xml",
            data: '<workbook><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
            method: 99,
          },
        ]),
      );

      await expectCliError(() => listXlsxSheetNames(workbookPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unsupported .xlsx ZIP compression method: 99",
      });
    });
  });

  test("listXlsxSheetNames reports missing workbook relationship metadata", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "missing-workbook-rels.xlsx");
      await writeFile(
        workbookPath,
        createStoredZip([
          {
            fileName: "xl/workbook.xml",
            data: '<workbook><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
          },
        ]),
      );

      await expectCliError(() => listXlsxSheetNames(workbookPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "missing xl/_rels/workbook.xml.rels",
      });
    });
  });
});
