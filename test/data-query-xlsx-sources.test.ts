import { describe, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { listXlsxSheetNames } from "../src/cli/duckdb/xlsx-sources";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function createWorkbookWithInvalidCentralDirectoryOffset(): Buffer {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt32LE(0x000f423f, 12);
  buffer.writeUInt32LE(0x000f423f, 16);
  return buffer;
}

describe("xlsx source discovery", () => {
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
});
