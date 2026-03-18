import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { collectXlsxSheetSnapshot, listXlsxSheetNames } from "../src/cli/duckdb/xlsx-sources";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";

function createWorkbookWithInvalidCentralDirectoryOffset(): Buffer {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt32LE(0x000f423f, 12);
  buffer.writeUInt32LE(0x000f423f, 16);
  return buffer;
}

describe("xlsx source discovery", () => {
  test("collectXlsxSheetSnapshot summarizes non-empty rows and used range for a simple workbook", async () => {
    const snapshot = await collectXlsxSheetSnapshot("test/fixtures/data-query/multi.xlsx", "Summary");

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

      await expectCliError(
        () => listXlsxSheetNames(workbookPath),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "failed to read workbook metadata",
        },
      );
    });
  });

  test("collectXlsxSheetSnapshot captures merged ranges for the collapsed merged-sheet fixture", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const workbookPath = join(fixtureDir, "collapsed-merged.xlsx");

      const snapshot = await collectXlsxSheetSnapshot(workbookPath, "Summary");

      expect(snapshot.sheetName).toBe("Summary");
      expect(snapshot.mergedRanges).toEqual(["B2:D2"]);
      expect(snapshot.usedRange).toBe("B2:B8");
      expect(snapshot.rows[0]).toEqual({
        cellCount: 1,
        cells: [{ ref: "B2", value: "Hello This Is The Merged" }],
        firstRef: "B2",
        lastRef: "B2",
        rowNumber: 2,
      });
    });
  });
});
