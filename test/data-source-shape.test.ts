import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CliError } from "../src/cli/errors";
import {
  createDataSourceShapeArtifact,
  createSourceShapeInputReference,
  generateDataSourceShapeFileName,
  readDataSourceShapeArtifact,
  resolveReusableSourceShape,
  suggestDataSourceShapeWithCodex,
  writeDataSourceShapeArtifact,
} from "../src/cli/duckdb/source-shape";
import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("data source shape artifacts", () => {
  test("generateDataSourceShapeFileName uses the shared filename family", () => {
    expect(generateDataSourceShapeFileName()).toMatch(/^data-source-shape-[0-9a-f]{10}\.json$/);
  });

  test("createSourceShapeInputReference stores one normalized CLI-facing path representation", () => {
    const inputReference = createSourceShapeInputReference({
      cwd: REPO_ROOT,
      format: "excel",
      inputPath: join(REPO_ROOT, "test", "fixtures", "data-query", "multi.xlsx"),
      source: "Summary",
    });

    expect(inputReference).toEqual({
      format: "excel",
      path: "test/fixtures/data-query/multi.xlsx",
      source: "Summary",
    });
  });

  test("writeDataSourceShapeArtifact preserves unknown fields when rewriting a version 1 artifact", async () => {
    await withTempFixtureDir("source-shape", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-source-shape-test.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify({
          extraTopLevel: "preserve-me",
          input: {
            extraInputField: "keep-me",
            format: "excel",
            path: "examples/playground/data-extract/messy.xlsx",
            source: "Summary",
          },
          metadata: {
            artifactType: "data-source-shape",
            extraMetadata: "preserve-metadata",
            issuedAt: "2026-03-18T00:00:00.000Z",
          },
          shape: {
            note: "keep-this-too",
            range: "B7:E11",
          },
          version: 1,
        }, null, 2)}\n`,
        "utf8",
      );

      const nextArtifact = createDataSourceShapeArtifact({
        input: {
          format: "excel",
          path: "examples/playground/data-extract/messy.xlsx",
          source: "Summary",
        },
        now: new Date("2026-03-18T12:34:56.000Z"),
        shape: {
          range: "C7:F11",
        },
      });

      await writeDataSourceShapeArtifact(artifactPath, nextArtifact, { overwrite: true });

      const rewritten = JSON.parse(await readFile(artifactPath, "utf8")) as Record<string, unknown>;
      expect(rewritten.extraTopLevel).toBe("preserve-me");
      expect((rewritten.metadata as Record<string, unknown>).extraMetadata).toBe("preserve-metadata");
      expect((rewritten.input as Record<string, unknown>).extraInputField).toBe("keep-me");
      expect((rewritten.shape as Record<string, unknown>).note).toBe("keep-this-too");
      expect((rewritten.shape as Record<string, unknown>).range).toBe("C7:F11");
    });
  });

  test("readDataSourceShapeArtifact accepts optional headerRow and preserves range-only compatibility", async () => {
    await withTempFixtureDir("source-shape", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-source-shape-test.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify({
          input: {
            format: "excel",
            path: "examples/playground/data-extract/messy.xlsx",
            source: "Summary",
          },
          metadata: {
            artifactType: "data-source-shape",
            issuedAt: "2026-03-18T00:00:00.000Z",
          },
          shape: {
            headerRow: 7,
            range: "B7:E11",
          },
          version: 1,
        }, null, 2)}\n`,
        "utf8",
      );

      await expect(readDataSourceShapeArtifact(artifactPath)).resolves.toEqual({
        input: {
          format: "excel",
          path: "examples/playground/data-extract/messy.xlsx",
          source: "Summary",
        },
        metadata: {
          artifactType: "data-source-shape",
          issuedAt: "2026-03-18T00:00:00.000Z",
        },
        shape: {
          headerRow: 7,
          range: "B7:E11",
        },
        version: 1,
      });
    });
  });

  test("readDataSourceShapeArtifact accepts bodyStartRow-only widened version 1 artifacts", async () => {
    await withTempFixtureDir("source-shape", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-source-shape-test.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify({
          input: {
            format: "excel",
            path: "examples/playground/data-extract/stacked-merged-band.xlsx",
            source: "Sheet1",
          },
          metadata: {
            artifactType: "data-source-shape",
            issuedAt: "2026-03-19T00:00:00.000Z",
          },
          shape: {
            bodyStartRow: 10,
          },
          version: 1,
        }, null, 2)}\n`,
        "utf8",
      );

      await expect(readDataSourceShapeArtifact(artifactPath)).resolves.toEqual({
        input: {
          format: "excel",
          path: "examples/playground/data-extract/stacked-merged-band.xlsx",
          source: "Sheet1",
        },
        metadata: {
          artifactType: "data-source-shape",
          issuedAt: "2026-03-19T00:00:00.000Z",
        },
        shape: {
          bodyStartRow: 10,
        },
        version: 1,
      });
    });
  });

  test("suggestDataSourceShapeWithCodex accepts null for omitted structured-output fields", async () => {
    await expect(
      suggestDataSourceShapeWithCodex({
        context: {
          currentIntrospection: {
            columns: [{ name: "RAW_TITLE", type: "DOUBLE" }],
            sampleRows: [],
            selectedSource: "Summary",
            truncated: false,
          },
          sheetSnapshot: {
            mergedRanges: [],
            mergedRangesTruncated: false,
            nonEmptyCellCount: 4,
            nonEmptyRowCount: 2,
            rows: [
              {
                cellCount: 1,
                cells: [{ ref: "A1", value: "RAW_TITLE" }],
                firstRef: "A1",
                lastRef: "A1",
                rowNumber: 1,
              },
            ],
            rowsTruncated: false,
            sheetName: "Summary",
            usedRange: "A1:B3",
          },
        },
        runner: async () =>
          JSON.stringify({
            body_start_row: null,
            header_row: null,
            range: "A1:B3",
            reasoning_summary: "The range is sufficient, and the automatic header row is acceptable.",
          }),
        workingDirectory: REPO_ROOT,
      }),
    ).resolves.toEqual({
      reasoningSummary: "The range is sufficient, and the automatic header row is acceptable.",
      shape: {
        range: "A1:B3",
      },
    });
  });

  test("suggestDataSourceShapeWithCodex accepts body_start_row as the only needed deterministic change", async () => {
    await expect(
      suggestDataSourceShapeWithCodex({
        context: {
          currentIntrospection: {
            columns: [{ name: "column_1", type: "DOUBLE" }],
            sampleRows: [{ column_1: "1" }],
            selectedSource: "Sheet1",
            truncated: false,
          },
          sheetSnapshot: {
            mergedRanges: ["B7:D9", "E7:AK9", "AL7:AY9", "AZ7:BR9"],
            mergedRangesTruncated: false,
            nonEmptyCellCount: 12,
            nonEmptyRowCount: 3,
            rows: [
              {
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
              },
            ],
            rowsTruncated: false,
            sheetName: "Sheet1",
            usedRange: "B7:AZ20",
          },
        },
        runner: async () =>
          JSON.stringify({
            body_start_row: 10,
            header_row: null,
            range: null,
            reasoning_summary: "The existing rectangle and header row are fine, but the logical body starts at worksheet row 10.",
          }),
        workingDirectory: REPO_ROOT,
      }),
    ).resolves.toEqual({
      reasoningSummary: "The existing rectangle and header row are fine, but the logical body starts at worksheet row 10.",
      shape: {
        bodyStartRow: 10,
      },
    });
  });

  test("writeDataSourceShapeArtifact replaces non-artifact files when overwrite is enabled", async () => {
    await withTempFixtureDir("source-shape", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-source-shape-test.json");
      await writeFile(artifactPath, "not json\n", "utf8");

      const nextArtifact = createDataSourceShapeArtifact({
        input: {
          format: "excel",
          path: "examples/playground/data-extract/messy.xlsx",
          source: "Summary",
        },
        now: new Date("2026-03-18T12:34:56.000Z"),
        shape: {
          range: "B7:E11",
        },
      });

      await writeDataSourceShapeArtifact(artifactPath, nextArtifact, { overwrite: true });

      const rewritten = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string; source: string };
        metadata: { artifactType: string; issuedAt: string };
        shape: { range: string };
        version: number;
      };
      expect(rewritten).toEqual({
        input: {
          format: "excel",
          path: "examples/playground/data-extract/messy.xlsx",
          source: "Summary",
        },
        metadata: {
          artifactType: "data-source-shape",
          issuedAt: "2026-03-18T12:34:56.000Z",
        },
        shape: {
          range: "B7:E11",
        },
        version: 1,
      });
    });
  });

  test("resolveReusableSourceShape fails on exact input-context mismatches", () => {
    expect(() =>
      resolveReusableSourceShape({
        artifact: createDataSourceShapeArtifact({
          input: {
            format: "excel",
            path: "examples/playground/data-extract/messy-a.xlsx",
            source: "Summary",
          },
          now: new Date("2026-03-18T00:00:00.000Z"),
          shape: {
            range: "B7:E11",
          },
        }),
        currentInput: {
          format: "excel",
          path: "examples/playground/data-extract/messy-b.xlsx",
          source: "Summary",
        },
      }),
    ).toThrow(CliError);

    try {
      resolveReusableSourceShape({
        artifact: createDataSourceShapeArtifact({
          input: {
            format: "excel",
            path: "examples/playground/data-extract/messy-a.xlsx",
            source: "Summary",
          },
          now: new Date("2026-03-18T00:00:00.000Z"),
          shape: {
            range: "B7:E11",
          },
        }),
        currentInput: {
          format: "excel",
          path: "examples/playground/data-extract/messy-b.xlsx",
          source: "Summary",
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain("does not match the current input context exactly");
    }
  });

  test("resolveReusableSourceShape returns headerRow when the reviewed artifact matches exactly", () => {
    expect(
      resolveReusableSourceShape({
        artifact: createDataSourceShapeArtifact({
          input: {
            format: "excel",
            path: "examples/playground/data-extract/messy-a.xlsx",
            source: "Summary",
          },
          now: new Date("2026-03-18T00:00:00.000Z"),
          shape: {
            headerRow: 7,
            range: "B7:E11",
          },
        }),
        currentInput: {
          format: "excel",
          path: "examples/playground/data-extract/messy-a.xlsx",
          source: "Summary",
        },
      }),
    ).toEqual({
      headerRow: 7,
      range: "B7:E11",
      source: "Summary",
    });
  });

  test("resolveReusableSourceShape returns bodyStartRow when the reviewed artifact matches exactly", () => {
    expect(
      resolveReusableSourceShape({
        artifact: createDataSourceShapeArtifact({
          input: {
            format: "excel",
            path: "examples/playground/data-extract/stacked-merged-band.xlsx",
            source: "Sheet1",
          },
          now: new Date("2026-03-19T00:00:00.000Z"),
          shape: {
            bodyStartRow: 10,
            headerRow: 7,
            range: "B7:BR20",
          },
        }),
        currentInput: {
          format: "excel",
          path: "examples/playground/data-extract/stacked-merged-band.xlsx",
          source: "Sheet1",
        },
      }),
    ).toEqual({
      bodyStartRow: 10,
      headerRow: 7,
      range: "B7:BR20",
      source: "Sheet1",
    });
  });
});
