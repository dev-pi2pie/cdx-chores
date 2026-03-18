import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CliError } from "../src/cli/errors";
import {
  createDataHeaderMappingArtifact,
  createHeaderMappingInputReference,
  generateDataHeaderMappingFileName,
  resolveReusableHeaderMappings,
  writeDataHeaderMappingArtifact,
} from "../src/cli/duckdb/header-mapping";
import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("data header mapping artifacts", () => {
  test("generateDataHeaderMappingFileName uses the shared filename family", () => {
    expect(generateDataHeaderMappingFileName()).toMatch(/^data-header-mapping-[0-9a-f]{10}\.json$/);
  });

  test("createHeaderMappingInputReference stores one normalized CLI-facing path representation", () => {
    const inputReference = createHeaderMappingInputReference({
      cwd: REPO_ROOT,
      format: "excel",
      inputPath: join(REPO_ROOT, "test", "fixtures", "data-query", "multi.xlsx"),
      shape: {
        range: "A1:B3",
        source: "Summary",
      },
    });

    expect(inputReference).toEqual({
      format: "excel",
      path: "test/fixtures/data-query/multi.xlsx",
      range: "A1:B3",
      source: "Summary",
    });
  });

  test("writeDataHeaderMappingArtifact preserves unknown fields when rewriting a version 1 artifact", async () => {
    await withTempFixtureDir("header-mapping", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-header-mapping-test.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify({
          extraTopLevel: "preserve-me",
          input: {
            extraInputField: "keep-me",
            format: "csv",
            path: "examples/playground/data.csv",
          },
          mappings: [
            { confidence: 0.92, from: "column_1", to: "id" },
            { note: "keep-this-too", from: "column_2", to: "name" },
          ],
          metadata: {
            artifactType: "data-header-mapping",
            extraMetadata: "preserve-metadata",
            issuedAt: "2026-03-18T00:00:00.000Z",
          },
          version: 1,
        }, null, 2)}\n`,
        "utf8",
      );

      const nextArtifact = createDataHeaderMappingArtifact({
        input: {
          format: "csv",
          path: "examples/playground/data.csv",
        },
        mappings: [
          { from: "column_1", to: "record_id" },
          { from: "column_2", to: "display_name" },
        ],
        now: new Date("2026-03-18T12:34:56.000Z"),
      });

      await writeDataHeaderMappingArtifact(artifactPath, nextArtifact, { overwrite: true });

      const rewritten = JSON.parse(await readFile(artifactPath, "utf8")) as Record<string, unknown>;
      expect(rewritten.extraTopLevel).toBe("preserve-me");
      expect((rewritten.metadata as Record<string, unknown>).extraMetadata).toBe("preserve-metadata");
      expect((rewritten.input as Record<string, unknown>).extraInputField).toBe("keep-me");
      expect((rewritten.mappings as Array<Record<string, unknown>>)[0]?.confidence).toBe(0.92);
      expect((rewritten.mappings as Array<Record<string, unknown>>)[1]?.note).toBe("keep-this-too");
      expect((rewritten.mappings as Array<Record<string, unknown>>)[0]?.to).toBe("record_id");
      expect((rewritten.mappings as Array<Record<string, unknown>>)[1]?.to).toBe("display_name");
    });
  });

  test("writeDataHeaderMappingArtifact replaces non-artifact files when overwrite is enabled", async () => {
    await withTempFixtureDir("header-mapping", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-header-mapping-test.json");
      await writeFile(artifactPath, "not json\n", "utf8");

      const nextArtifact = createDataHeaderMappingArtifact({
        input: {
          format: "csv",
          path: "examples/playground/data.csv",
        },
        mappings: [{ from: "column_1", to: "record_id" }],
        now: new Date("2026-03-18T12:34:56.000Z"),
      });

      await writeDataHeaderMappingArtifact(artifactPath, nextArtifact, { overwrite: true });

      const rewritten = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; to: string }>;
        metadata: { artifactType: string };
        version: number;
      };
      expect(rewritten).toEqual({
        input: {
          format: "csv",
          path: "examples/playground/data.csv",
        },
        mappings: [{ from: "column_1", to: "record_id" }],
        metadata: {
          artifactType: "data-header-mapping",
          issuedAt: "2026-03-18T12:34:56.000Z",
        },
        version: 1,
      });
    });
  });

  test("resolveReusableHeaderMappings fails on exact input-context mismatches", () => {
    expect(() =>
      resolveReusableHeaderMappings({
        artifact: createDataHeaderMappingArtifact({
          input: {
            format: "csv",
            path: "examples/playground/data-a.csv",
          },
          mappings: [{ from: "column_1", to: "id" }],
          now: new Date("2026-03-18T00:00:00.000Z"),
        }),
        currentInput: {
          format: "csv",
          path: "examples/playground/data-b.csv",
        },
      }),
    ).toThrow(CliError);

    try {
      resolveReusableHeaderMappings({
        artifact: createDataHeaderMappingArtifact({
          input: {
            format: "csv",
            path: "examples/playground/data-a.csv",
          },
          mappings: [{ from: "column_1", to: "id" }],
          now: new Date("2026-03-18T00:00:00.000Z"),
        }),
        currentInput: {
          format: "csv",
          path: "examples/playground/data-b.csv",
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain("does not match the current input context exactly");
    }
  });
});
