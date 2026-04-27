import { describe, expect, test } from "bun:test";

import {
  createDataStackPlanIdentity,
  generateDataStackPlanFileName,
  serializeDataStackPlanArtifact,
  type DataStackPlanArtifact,
} from "../../src/cli/data-stack/plan";
import { createSampleDataStackPlan } from "../helpers/data-stack-test-utils";

describe("data stack plan artifact identity and serialization", () => {
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
    expect(createSampleDataStackPlan()).toEqual({
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
    const sample = createSampleDataStackPlan();
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
});
