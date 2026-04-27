import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseDataStackPlanArtifact,
  readDataStackPlanArtifact,
  serializeDataStackPlanArtifact,
  writeDataStackPlanArtifact,
} from "../../src/cli/data-stack/plan";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import {
  createSampleDataStackPlan,
  expectCliError,
  expectRejectedCliError,
} from "../helpers/data-stack-test-utils";

describe("data stack plan artifact parsing and I/O", () => {
  test("readDataStackPlanArtifact round-trips a valid v1 artifact", async () => {
    await withTempFixtureDir("data-stack-plan", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "data-stack-plan-test.json");
      await writeDataStackPlanArtifact(artifactPath, createSampleDataStackPlan());

      await expect(readDataStackPlanArtifact(artifactPath)).resolves.toEqual(
        createSampleDataStackPlan(),
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
          ...createSampleDataStackPlan(),
          metadata: {
            ...createSampleDataStackPlan().metadata,
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
        `${JSON.stringify({ ...createSampleDataStackPlan(), version: 2 }, null, 2)}\n`,
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
        writeDataStackPlanArtifact(artifactPath, createSampleDataStackPlan()),
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

      await writeDataStackPlanArtifact(artifactPath, createSampleDataStackPlan(), {
        overwrite: true,
      });

      expect(await readFile(artifactPath, "utf8")).toBe(
        serializeDataStackPlanArtifact(createSampleDataStackPlan()),
      );
    });
  });

  test("parseDataStackPlanArtifact rejects non-stack-plan JSON", () => {
    expectCliError(
      () =>
        parseDataStackPlanArtifact({
          ...createSampleDataStackPlan(),
          metadata: {
            ...createSampleDataStackPlan().metadata,
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
          ...createSampleDataStackPlan(),
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
          ...createSampleDataStackPlan(),
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
          ...createSampleDataStackPlan(),
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
          ...createSampleDataStackPlan(),
          duplicates: {
            ...createSampleDataStackPlan().duplicates,
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
          ...createSampleDataStackPlan(),
          metadata: {
            ...createSampleDataStackPlan().metadata,
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
          ...createSampleDataStackPlan(),
          sources: {
            ...createSampleDataStackPlan().sources,
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
