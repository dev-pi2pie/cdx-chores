import { expect } from "bun:test";

import { computeDataStackDiagnostics } from "../../src/cli/data-stack/diagnostics";
import {
  createDataStackPlanArtifact,
  type DataStackPlanArtifact,
} from "../../src/cli/data-stack/plan";
import {
  createDataStackCodexReportArtifact,
  type DataStackCodexReportArtifact,
} from "../../src/cli/data-stack/codex-report";
import { CliError } from "../../src/cli/errors";

export function createSampleDataStackPlan(): DataStackPlanArtifact {
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

export function createDataStackCodexTestPlan(): DataStackPlanArtifact {
  const rows = [
    ["1", "active", "north"],
    ["2", "paused", "south"],
  ];
  const diagnostics = computeDataStackDiagnostics({
    header: ["id", "status", "region"],
    matchedFileCount: 1,
    rows,
  });
  return createDataStackPlanArtifact({
    diagnostics: diagnostics.planDiagnostics,
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
    now: new Date("2026-04-26T00:00:00.000Z"),
    output: {
      format: "csv",
      overwrite: false,
      path: "merged.csv",
    },
    schema: {
      excludedNames: [],
      includedNames: ["id", "status", "region"],
      mode: "strict",
    },
    sources: {
      baseDirectory: ".",
      maxDepth: null,
      pattern: "*.csv",
      raw: ["inputs"],
      recursive: false,
      resolved: [{ kind: "file", path: "inputs/a.csv" }],
    },
    uid: "aaaabbbb",
  });
}

export function createDataStackCodexUnionModePlan(): DataStackPlanArtifact {
  const plan = createDataStackCodexTestPlan();
  return {
    ...plan,
    schema: {
      ...plan.schema,
      mode: "union-by-name",
    },
  };
}

export function createDataStackCodexTestReport(
  plan: DataStackPlanArtifact,
): DataStackCodexReportArtifact {
  const diagnostics = computeDataStackDiagnostics({
    header: plan.schema.includedNames,
    matchedFileCount: 1,
    rows: [
      ["1", "active", "north"],
      ["2", "paused", "south"],
    ],
  });
  return createDataStackCodexReportArtifact({
    diagnostics,
    now: new Date("2026-04-26T00:01:00.000Z"),
    plan,
    recommendations: [
      {
        confidence: 0.91,
        id: "rec_unique_id",
        patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
        reasoningSummary: "The id column has no nulls or duplicates.",
        title: "Use id as unique key",
      },
      {
        confidence: 0.7,
        id: "rec_report_duplicates",
        patches: [{ op: "replace", path: "/duplicates/policy", value: "report" }],
        reasoningSummary: "Report keeps rows while surfacing duplicate diagnostics.",
        title: "Report duplicate findings",
      },
    ],
    uid: "ccccdddd",
  });
}

export function expectCliError(
  run: () => unknown,
  options:
    | string
    | {
        code?: string;
        messageIncludes?: string;
      } = {},
): void {
  const normalized = typeof options === "string" ? { messageIncludes: options } : options;
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    if (normalized.code) {
      expect((error as CliError).code).toBe(normalized.code);
    }
    if (normalized.messageIncludes) {
      expect((error as CliError).message).toContain(normalized.messageIncludes);
    }
    return;
  }
  throw new Error("Expected CliError.");
}

export async function expectRejectedCliError(
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
