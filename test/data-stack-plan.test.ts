import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CliError } from "../src/cli/errors";
import {
  createDataStackPlanArtifact,
  createDataStackPlanIdentity,
  generateDataStackPlanFileName,
  parseDataStackPlanArtifact,
  readDataStackPlanArtifact,
  serializeDataStackPlanArtifact,
  writeDataStackPlanArtifact,
  type DataStackPlanArtifact,
} from "../src/cli/data-stack/plan";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function createSampleStackPlan(): DataStackPlanArtifact {
  return createDataStackPlanArtifact({
    diagnostics: {
      candidateUniqueKeys: [
        {
          columns: ["id"],
          duplicateRows: 0,
          nullRows: 0,
        },
      ],
      matchedFileCount: 1,
      reportPath: null,
      rowCount: 25,
      schemaNameCount: 3,
    },
    duplicates: {
      duplicateKeyConflicts: 0,
      exactDuplicateRows: 0,
      policy: "preserve",
      uniqueBy: [],
    },
    input: {
      columns: [],
      format: "csv",
      headerMode: "header",
    },
    now: new Date("2026-04-25T12:00:00.000Z"),
    output: {
      format: "csv",
      overwrite: false,
      path: "merged.csv",
    },
    schema: {
      excludedNames: [],
      includedNames: ["id", "name", "status"],
      mode: "strict",
    },
    sources: {
      baseDirectory: ".",
      maxDepth: null,
      pattern: "*.csv",
      raw: ["./inputs"],
      recursive: false,
      resolved: [
        {
          fingerprint: {
            mtimeMs: 1777118400000,
            sizeBytes: 1234,
          },
          kind: "file",
          path: "inputs/part-001.csv",
        },
      ],
    },
    uid: "a1b2c3d4",
  });
}

function expectCliError(
  run: () => unknown,
  options: {
    code?: string;
    messageIncludes?: string;
  } = {},
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    if (options.code) {
      expect((error as CliError).code).toBe(options.code);
    }
    if (options.messageIncludes) {
      expect((error as CliError).message).toContain(options.messageIncludes);
    }
    return;
  }
  throw new Error("Expected CliError.");
}

async function expectRejectedCliError(
  promise: Promise<unknown>,
  options: {
    code?: string;
    messageIncludes?: string;
  } = {},
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    if (options.code) {
      expect((error as CliError).code).toBe(options.code);
    }
    if (options.messageIncludes) {
      expect((error as CliError).message).toContain(options.messageIncludes);
    }
    return;
  }
  throw new Error("Expected CliError.");
}

describe("data stack plan artifacts", () => {
  test("createDataStackPlanIdentity uses the timestamp and uid artifact family", () => {
    expect(
      createDataStackPlanIdentity({
        now: new Date("2026-04-25T12:00:00.000Z"),
        uid: "a1b2c3d4",
      }),
    ).toEqual({
      artifactId: "data-stack-plan-20260425T120000Z-a1b2c3d4",
      fileName: "data-stack-plan-20260425T120000Z-a1b2c3d4.json",
      payloadId: "stack-payload-20260425T120000Z-a1b2c3d4",
      timestamp: "20260425T120000Z",
      uid: "a1b2c3d4",
    });
  });

  test("generateDataStackPlanFileName uses the provided timestamp", () => {
    expect(generateDataStackPlanFileName(new Date("2026-04-25T12:00:00.000Z"))).toMatch(
      /^data-stack-plan-20260425T120000Z-[0-9a-f]{8}\.json$/,
    );
  });

  test("createDataStackPlanArtifact fills required metadata and command fields", () => {
    expect(createSampleStackPlan()).toEqual({
      command: {
        action: "stack",
        family: "data",
        replayCommand: "data stack replay",
      },
      diagnostics: {
        candidateUniqueKeys: [
          {
            columns: ["id"],
            duplicateRows: 0,
            nullRows: 0,
          },
        ],
        matchedFileCount: 1,
        reportPath: null,
        rowCount: 25,
        schemaNameCount: 3,
      },
      duplicates: {
        duplicateKeyConflicts: 0,
        exactDuplicateRows: 0,
        policy: "preserve",
        uniqueBy: [],
      },
      input: {
        columns: [],
        format: "csv",
        headerMode: "header",
      },
      metadata: {
        acceptedRecommendationIds: [],
        artifactId: "data-stack-plan-20260425T120000Z-a1b2c3d4",
        artifactType: "data-stack-plan",
        createdBy: "cdx-chores data stack --dry-run",
        derivedFromPayloadId: null,
        issuedAt: "2026-04-25T12:00:00.000Z",
        payloadId: "stack-payload-20260425T120000Z-a1b2c3d4",
        recommendationDecisions: [],
      },
      output: {
        format: "csv",
        overwrite: false,
        path: "merged.csv",
      },
      schema: {
        excludedNames: [],
        includedNames: ["id", "name", "status"],
        mode: "strict",
      },
      sources: {
        baseDirectory: ".",
        maxDepth: null,
        pattern: "*.csv",
        raw: ["./inputs"],
        recursive: false,
        resolved: [
          {
            fingerprint: {
              mtimeMs: 1777118400000,
              sizeBytes: 1234,
            },
            kind: "file",
            path: "inputs/part-001.csv",
          },
        ],
      },
      version: 1,
    });
  });

  test("serializeDataStackPlanArtifact uses stable v1 field ordering", () => {
    const sample = createSampleStackPlan();
    const shuffled = {
      diagnostics: sample.diagnostics,
      output: sample.output,
      duplicates: sample.duplicates,
      version: sample.version,
      schema: sample.schema,
      input: sample.input,
      sources: sample.sources,
      command: sample.command,
      metadata: sample.metadata,
    } as DataStackPlanArtifact;

    expect(serializeDataStackPlanArtifact(shuffled)).toBe(
      `${JSON.stringify(
        {
          version: 1,
          metadata: {
            artifactType: "data-stack-plan",
            artifactId: "data-stack-plan-20260425T120000Z-a1b2c3d4",
            payloadId: "stack-payload-20260425T120000Z-a1b2c3d4",
            derivedFromPayloadId: null,
            acceptedRecommendationIds: [],
            recommendationDecisions: [],
            issuedAt: "2026-04-25T12:00:00.000Z",
            createdBy: "cdx-chores data stack --dry-run",
          },
          command: {
            family: "data",
            action: "stack",
            replayCommand: "data stack replay",
          },
          sources: {
            baseDirectory: ".",
            raw: ["./inputs"],
            pattern: "*.csv",
            recursive: false,
            maxDepth: null,
            resolved: [
              {
                path: "inputs/part-001.csv",
                kind: "file",
                fingerprint: {
                  sizeBytes: 1234,
                  mtimeMs: 1777118400000,
                },
              },
            ],
          },
          input: {
            format: "csv",
            headerMode: "header",
            columns: [],
          },
          schema: {
            mode: "strict",
            includedNames: ["id", "name", "status"],
            excludedNames: [],
          },
          duplicates: {
            policy: "preserve",
            uniqueBy: [],
            exactDuplicateRows: 0,
            duplicateKeyConflicts: 0,
          },
          output: {
            format: "csv",
            path: "merged.csv",
            overwrite: false,
          },
          diagnostics: {
            matchedFileCount: 1,
            rowCount: 25,
            schemaNameCount: 3,
            candidateUniqueKeys: [
              {
                columns: ["id"],
                nullRows: 0,
                duplicateRows: 0,
              },
            ],
            reportPath: null,
          },
        },
        null,
        2,
      )}\n`,
    );
  });

  test("readDataStackPlanArtifact round-trips a valid v1 artifact", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeDataStackPlanArtifact(artifactPath, createSampleStackPlan());

      await expect(readDataStackPlanArtifact(artifactPath)).resolves.toEqual(
        createSampleStackPlan(),
      );
    });
  });

  test("readDataStackPlanArtifact rejects invalid JSON", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeFile(artifactPath, "{not-json}\n", "utf8");

      await expectRejectedCliError(readDataStackPlanArtifact(artifactPath), {
        code: "INVALID_INPUT",
        messageIncludes: "Invalid data stack plan artifact JSON",
      });
    });
  });

  test("readDataStackPlanArtifact wraps file-read failures", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      await expectRejectedCliError(
        readDataStackPlanArtifact(join(fixtureDir, "missing-plan.json")),
        {
          code: "FILE_READ_ERROR",
          messageIncludes: "Failed to read data stack plan artifact",
        },
      );
    });
  });

  test("readDataStackPlanArtifact rejects wrong artifact type from disk", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeFile(
        artifactPath,
        serializeDataStackPlanArtifact({
          ...createSampleStackPlan(),
          metadata: {
            ...createSampleStackPlan().metadata,
            artifactType: "data-stack-codex-report" as "data-stack-plan",
          },
        }),
        "utf8",
      );

      await expectRejectedCliError(readDataStackPlanArtifact(artifactPath), {
        code: "INVALID_INPUT",
        messageIncludes: "metadata.artifactType",
      });
    });
  });

  test("readDataStackPlanArtifact rejects unsupported versions from disk", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify({ ...createSampleStackPlan(), version: 2 }, null, 2)}\n`,
        "utf8",
      );

      await expectRejectedCliError(readDataStackPlanArtifact(artifactPath), {
        code: "INVALID_INPUT",
        messageIncludes: "Unsupported data stack plan artifact version",
      });
    });
  });

  test("writeDataStackPlanArtifact refuses to overwrite existing files by default", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeFile(artifactPath, "existing\n", "utf8");

      await expectRejectedCliError(
        writeDataStackPlanArtifact(artifactPath, createSampleStackPlan()),
        {
          code: "OUTPUT_EXISTS",
          messageIncludes: "Output file already exists",
        },
      );
      expect(await readFile(artifactPath, "utf8")).toBe("existing\n");
    });
  });

  test("writeDataStackPlanArtifact replaces existing files when overwrite is enabled", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeFile(artifactPath, "existing\n", "utf8");

      await writeDataStackPlanArtifact(artifactPath, createSampleStackPlan(), { overwrite: true });

      expect(await readFile(artifactPath, "utf8")).toBe(
        serializeDataStackPlanArtifact(createSampleStackPlan()),
      );
    });
  });

  test("parseDataStackPlanArtifact rejects non-stack-plan JSON", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          metadata: {
            ...createSampleStackPlan().metadata,
            artifactType: "data-stack-codex-report",
          },
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "metadata.artifactType",
      },
    );
  });

  test("parseDataStackPlanArtifact rejects unsupported versions", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          version: 2,
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "Unsupported data stack plan artifact version",
      },
    );
  });

  test("parseDataStackPlanArtifact rejects missing top-level sections", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          metadata: undefined,
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "metadata must be an object",
      },
    );
  });

  test("parseDataStackPlanArtifact requires columns for headerless replay", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          input: {
            columns: [],
            format: "csv",
            headerMode: "no-header",
          },
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "input.columns is required",
      },
    );
  });

  test("parseDataStackPlanArtifact validates required nested fields", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          duplicates: {
            ...createSampleStackPlan().duplicates,
            policy: "keep-first",
          },
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "duplicates.policy",
      },
    );
  });

  test("parseDataStackPlanArtifact validates recommendation decision metadata", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          metadata: {
            ...createSampleStackPlan().metadata,
            acceptedRecommendationIds: [],
            recommendationDecisions: [
              {
                decision: "accepted",
                recommendationId: "rec-001",
                reportArtifactId: "data-stack-codex-report-20260425T120500Z-d4c3b2a1",
              },
            ],
          },
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "acceptedRecommendationIds must match",
      },
    );
  });

  test("parseDataStackPlanArtifact validates source fingerprint bounds", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleStackPlan(),
          sources: {
            ...createSampleStackPlan().sources,
            resolved: [
              {
                fingerprint: {
                  mtimeMs: 1777118400000,
                  sizeBytes: -1,
                },
                kind: "file",
                path: "inputs/part-001.csv",
              },
            ],
          },
        }),
      {
        code: "INVALID_INPUT",
        messageIncludes: "sources.resolved[0].fingerprint.sizeBytes",
      },
    );
  });
});
