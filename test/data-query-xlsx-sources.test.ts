import { describe, expect, test } from "bun:test";
import { spawnSync } from "bun";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectXlsxSheetSnapshot, listXlsxSheetNames } from "../src/cli/duckdb/xlsx-sources";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import { seedStackedMergedBandFixture } from "./helpers/stacked-merged-band-fixture-test-utils";

function createWorkbookWithInvalidCentralDirectoryOffset(): Buffer {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt32LE(0x000f423f, 12);
  buffer.writeUInt32LE(0x000f423f, 16);
  return buffer;
}

async function createWorkbookWithReorderedMetadataAttributes(outputPath: string): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), "xlsx-attribute-order-"));

  try {
    const unpackDir = join(workspace, "unpacked");
    await mkdir(unpackDir, { recursive: true });

    const unzipProc = spawnSync({
      cmd: [
        "unzip",
        "-qq",
        join(REPO_ROOT, "test", "fixtures", "data-query", "multi.xlsx"),
        "-d",
        unpackDir,
      ],
      stderr: "pipe",
      stdout: "pipe",
    });
    if (unzipProc.exitCode !== 0) {
      throw new Error(Buffer.from(unzipProc.stderr).toString("utf8"));
    }

    const workbookPath = join(unpackDir, "xl", "workbook.xml");
    const workbookRelsPath = join(unpackDir, "xl", "_rels", "workbook.xml.rels");
    const workbookXml = await readFile(workbookPath, "utf8");
    const workbookRelsXml = await readFile(workbookRelsPath, "utf8");

    await writeFile(
      workbookPath,
      workbookXml.replace(
        /<sheet name="([^"]+)" sheetId="([^"]+)" r:id="([^"]+)"\/>/g,
        '<sheet r:id="$3" sheetId="$2" name="$1"/>',
      ),
      "utf8",
    );
    await writeFile(
      workbookRelsPath,
      workbookRelsXml.replace(
        /<Relationship Id="([^"]+)" Type="([^"]+)" Target="([^"]+)"\/>/g,
        '<Relationship Target="$3" Type="$2" Id="$1"/>',
      ),
      "utf8",
    );

    const zipProc = spawnSync({
      cmd: ["zip", "-qr", outputPath, "."],
      cwd: unpackDir,
      stderr: "pipe",
      stdout: "pipe",
    });
    if (zipProc.exitCode !== 0) {
      throw new Error(Buffer.from(zipProc.stderr).toString("utf8"));
    }
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

describe("xlsx source discovery", () => {
  test("collectXlsxSheetSnapshot summarizes non-empty rows and used range for a simple workbook", async () => {
    const snapshot = await collectXlsxSheetSnapshot(
      "test/fixtures/data-query/multi.xlsx",
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

  test("listXlsxSheetNames and sheet snapshots preserve the true anchors for the public stacked merged-band fixture", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const workbookPath = join(fixtureDir, "stacked-merged-band.xlsx");

      await expect(listXlsxSheetNames(workbookPath)).resolves.toEqual(["Sheet1"]);

      const snapshot = await collectXlsxSheetSnapshot(workbookPath, "Sheet1");

      expect(snapshot.sheetName).toBe("Sheet1");
      expect(snapshot.nonEmptyRowCount).toBeGreaterThan(0);
      expect(snapshot.usedRange).toBe("B5:BG20");
      expect(snapshot.mergedRanges.slice(0, 6)).toEqual([
        "A1:BS4",
        "BG5:BR6",
        "B7:D9",
        "E7:AK9",
        "AL7:AY9",
        "AZ7:BR9",
      ]);
      expect(snapshot.rows[0]).toEqual({
        cellCount: 1,
        cells: [{ ref: "BG5", value: "RAW_TITLE" }],
        firstRef: "BG5",
        lastRef: "BG5",
        rowNumber: 5,
      });
      expect(snapshot.rows[1]).toEqual({
        cellCount: 4,
        cells: [
          { ref: "B7", value: "id" },
          { ref: "E7", value: "question" },
          { ref: "AL7", value: "status" },
          { ref: "AZ7", value: "notes" },
        ],
        firstRef: "B7",
        lastRef: "AZ7",
        rowNumber: 7,
      });
      expect(snapshot.rows[2]).toEqual({
        cellCount: 4,
        cells: [
          { ref: "B10", value: "1.0" },
          { ref: "E10", value: "Does the customer need a follow-up call after the outage review?" },
          { ref: "AL10", value: "- [ ] Yes; - [ ] No" },
          { ref: "AZ10", value: "callback" },
        ],
        firstRef: "B10",
        lastRef: "AZ10",
        rowNumber: 10,
      });
    });
  });

  test("listXlsxSheetNames and collectXlsxSheetSnapshot tolerate reordered workbook metadata attributes", async () => {
    await withTempFixtureDir("xlsx-sources", async (fixtureDir) => {
      const workbookPath = join(fixtureDir, "reordered-attributes.xlsx");
      await createWorkbookWithReorderedMetadataAttributes(workbookPath);

      await expect(listXlsxSheetNames(workbookPath)).resolves.toEqual(["Summary", "RawData"]);

      const snapshot = await collectXlsxSheetSnapshot(workbookPath, "Summary");

      expect(snapshot.sheetName).toBe("Summary");
      expect(snapshot.usedRange).toBe("A1:C3");
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
  });
});
