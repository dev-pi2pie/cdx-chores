import { describe, expect, test } from "bun:test";

import {
  applyDataStackCodexRecommendationDecisions,
  createDataStackCodexReportArtifact,
  validateDataStackCodexRecommendation,
} from "../src/cli/data-stack/codex-report";
import { DATA_STACK_CODEX_OUTPUT_SCHEMA } from "../src/cli/data-stack/codex-assist";
import { computeDataStackDiagnostics } from "../src/cli/data-stack/diagnostics";
import {
  createDataStackPlanArtifact,
  type DataStackPlanArtifact,
} from "../src/cli/data-stack/plan";
import { CliError } from "../src/cli/errors";

function createPlan(): DataStackPlanArtifact {
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

function createReport(plan: DataStackPlanArtifact) {
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

function expectCliError(run: () => unknown, messageIncludes: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain(messageIncludes);
    return;
  }
  throw new Error("Expected CliError.");
}

describe("data stack Codex report helpers", () => {
  test("validates replace patches against supported stack-plan fields", () => {
    const plan = createPlan();
    const recommendation = validateDataStackCodexRecommendation(plan, {
      confidence: 0.8,
      id: "rec_policy",
      patches: [{ op: "replace", path: "/duplicates/policy", value: "reject" }],
      reasoningSummary: "Reject duplicates when writing clean output.",
      title: "Reject duplicates",
    });

    expect(recommendation.patches).toEqual([
      { op: "replace", path: "/duplicates/policy", value: "reject" },
    ]);
  });

  test("structured Codex output schema gives patch values an explicit type", () => {
    const recommendations = DATA_STACK_CODEX_OUTPUT_SCHEMA.properties.recommendations;
    const patchPath = recommendations.items.properties.patches.items.properties.path;
    const patchValue = recommendations.items.properties.patches.items.properties.value;

    expect(patchPath.enum).not.toContain("/schema/includedNames");
    expect(patchValue).toEqual({
      type: ["string", "array"],
      items: { type: "string" },
    });
  });

  test("applies schema-mode recommendations into the deterministic stack plan", () => {
    const plan = createPlan();
    const diagnostics = computeDataStackDiagnostics({
      header: plan.schema.includedNames,
      matchedFileCount: 1,
      rows: [
        ["1", "active", "north"],
        ["2", "paused", "south"],
      ],
    });
    const report = createDataStackCodexReportArtifact({
      diagnostics,
      now: new Date("2026-04-26T00:01:00.000Z"),
      plan,
      recommendations: [
        {
          confidence: 0.72,
          id: "rec_schema_union",
          patches: [{ op: "replace", path: "/schema/mode", value: "union-by-name" }],
          reasoningSummary: "Sources show deterministic schema drift.",
          title: "Use union by name",
        },
      ],
      uid: "bbbbcccc",
    });

    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_schema_union" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.schema.mode).toBe("union-by-name");
  });

  test("accepts schema exclusions only when the resulting schema state is executable", () => {
    const plan = createPlan();
    const recommendation = validateDataStackCodexRecommendation(plan, {
      confidence: 0.8,
      id: "rec_schema_exclusions",
      patches: [
        { op: "replace", path: "/schema/mode", value: "union-by-name" },
        { op: "replace", path: "/schema/excludedNames", value: ["status"] },
      ],
      reasoningSummary: "Union by name can exclude sparse status values.",
      title: "Exclude status in union mode",
    });

    expect(recommendation.patches).toEqual([
      { op: "replace", path: "/schema/mode", value: "union-by-name" },
      { op: "replace", path: "/schema/excludedNames", value: ["status"] },
    ]);
  });

  test("applies schema exclusions to included names in derived plans", () => {
    const plan = createPlan();
    const diagnostics = computeDataStackDiagnostics({
      header: plan.schema.includedNames,
      matchedFileCount: 1,
      rows: [
        ["1", "active", "north"],
        ["2", "paused", "south"],
      ],
    });
    const report = createDataStackCodexReportArtifact({
      diagnostics,
      now: new Date("2026-04-26T00:01:00.000Z"),
      plan,
      recommendations: [
        {
          confidence: 0.8,
          id: "rec_schema_exclusions",
          patches: [
            { op: "replace", path: "/schema/mode", value: "union-by-name" },
            { op: "replace", path: "/schema/excludedNames", value: ["status"] },
          ],
          reasoningSummary: "Union by name can exclude sparse status values.",
          title: "Exclude status in union mode",
        },
      ],
      uid: "bbbbdddd",
    });

    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_schema_exclusions" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.schema).toEqual({
      excludedNames: ["status"],
      includedNames: ["id", "region"],
      mode: "union-by-name",
    });
  });

  test("removes excluded schema names from derived unique keys", () => {
    const plan = createPlan();
    const diagnostics = computeDataStackDiagnostics({
      header: plan.schema.includedNames,
      matchedFileCount: 1,
      rows: [
        ["1", "active", "north"],
        ["2", "paused", "south"],
      ],
    });
    const report = createDataStackCodexReportArtifact({
      diagnostics,
      now: new Date("2026-04-26T00:01:00.000Z"),
      plan,
      recommendations: [
        {
          confidence: 0.8,
          id: "rec_schema_exclusions_with_key",
          patches: [
            { op: "replace", path: "/schema/mode", value: "union-by-name" },
            { op: "replace", path: "/duplicates/uniqueBy", value: ["id", "status"] },
            { op: "replace", path: "/schema/excludedNames", value: ["status"] },
          ],
          reasoningSummary: "Union by name can exclude sparse status values.",
          title: "Exclude status in union mode",
        },
      ],
      uid: "bbbbeeee",
    });

    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_schema_exclusions_with_key" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.duplicates.uniqueBy).toEqual(["id"]);
    expect(nextPlan.schema).toEqual({
      excludedNames: ["status"],
      includedNames: ["id", "region"],
      mode: "union-by-name",
    });
  });

  test("validates unique keys against patched headerless input columns", () => {
    const plan: DataStackPlanArtifact = {
      ...createPlan(),
      input: {
        columns: ["column_1", "column_2"],
        format: "csv",
        headerMode: "no-header",
      },
      schema: {
        excludedNames: [],
        includedNames: ["column_1", "column_2"],
        mode: "strict",
      },
    };
    const report = createDataStackCodexReportArtifact({
      diagnostics: computeDataStackDiagnostics({
        header: plan.schema.includedNames,
        matchedFileCount: 1,
        rows: [
          ["1", "active"],
          ["2", "paused"],
        ],
      }),
      now: new Date("2026-04-26T00:01:00.000Z"),
      plan,
      recommendations: [
        {
          confidence: 0.86,
          id: "rec_headerless_key",
          patches: [
            { op: "replace", path: "/input/columns", value: ["id", "status"] },
            { op: "replace", path: "/duplicates/uniqueBy", value: ["id"] },
          ],
          reasoningSummary: "The generated first column is a stable id.",
          title: "Name headerless id column",
        },
      ],
      uid: "ddddcccc",
    });

    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_headerless_key" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.input.columns).toEqual(["id", "status"]);
    expect(nextPlan.schema.includedNames).toEqual(["id", "status"]);
    expect(nextPlan.duplicates.uniqueBy).toEqual(["id"]);
  });

  test("remaps existing headerless unique keys after input column recommendations", () => {
    const plan: DataStackPlanArtifact = {
      ...createPlan(),
      duplicates: {
        duplicateKeyConflicts: 0,
        exactDuplicateRows: 0,
        policy: "preserve",
        uniqueBy: ["column_1"],
      },
      input: {
        columns: ["column_1", "column_2"],
        format: "csv",
        headerMode: "no-header",
      },
      schema: {
        excludedNames: [],
        includedNames: ["column_1", "column_2"],
        mode: "strict",
      },
    };
    const report = createDataStackCodexReportArtifact({
      diagnostics: computeDataStackDiagnostics({
        header: plan.schema.includedNames,
        matchedFileCount: 1,
        rows: [
          ["1", "active"],
          ["2", "paused"],
        ],
        uniqueBy: plan.duplicates.uniqueBy,
      }),
      now: new Date("2026-04-26T00:01:00.000Z"),
      plan,
      recommendations: [
        {
          confidence: 0.86,
          id: "rec_headerless_columns",
          patches: [{ op: "replace", path: "/input/columns", value: ["id", "status"] }],
          reasoningSummary: "The generated first column is a stable id.",
          title: "Name headerless columns",
        },
      ],
      uid: "dddddddd",
    });

    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_headerless_columns" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.input.columns).toEqual(["id", "status"]);
    expect(nextPlan.schema.includedNames).toEqual(["id", "status"]);
    expect(nextPlan.duplicates.uniqueBy).toEqual(["id"]);
  });

  test("rejects headerless column patches that leave unknown unique keys", () => {
    const plan: DataStackPlanArtifact = {
      ...createPlan(),
      duplicates: {
        duplicateKeyConflicts: 0,
        exactDuplicateRows: 0,
        policy: "preserve",
        uniqueBy: ["external_id"],
      },
      input: {
        columns: ["column_1", "column_2"],
        format: "csv",
        headerMode: "no-header",
      },
      schema: {
        excludedNames: [],
        includedNames: ["column_1", "column_2"],
        mode: "strict",
      },
    };
    expectCliError(
      () =>
        createDataStackCodexReportArtifact({
          diagnostics: computeDataStackDiagnostics({
            header: plan.schema.includedNames,
            matchedFileCount: 1,
            rows: [
              ["1", "active"],
              ["2", "paused"],
            ],
          }),
          now: new Date("2026-04-26T00:01:00.000Z"),
          plan,
          recommendations: [
            {
              confidence: 0.86,
              id: "rec_headerless_columns",
              patches: [{ op: "replace", path: "/input/columns", value: ["id", "status"] }],
              reasoningSummary: "Name generated columns.",
              title: "Name headerless columns",
            },
          ],
          uid: "ddddaaaa",
        }),
      "leaves duplicates.uniqueBy with unknown schema names",
    );
  });

  test("rejects headerless column patches that change column count", () => {
    const plan: DataStackPlanArtifact = {
      ...createPlan(),
      input: {
        columns: ["column_1", "column_2"],
        format: "csv",
        headerMode: "no-header",
      },
      schema: {
        excludedNames: [],
        includedNames: ["column_1", "column_2"],
        mode: "strict",
      },
    };

    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.86,
          id: "rec_headerless_short_columns",
          patches: [{ op: "replace", path: "/input/columns", value: ["id"] }],
          reasoningSummary: "Name the generated id column.",
          title: "Name headerless id column",
        }),
      "must preserve the headerless column count",
    );
  });

  test("rejects unsupported or conflicting patch shapes", () => {
    const plan = createPlan();
    const headerlessPlan: DataStackPlanArtifact = {
      ...plan,
      input: {
        columns: ["column_1", "column_2"],
        format: "csv",
        headerMode: "no-header",
      },
      schema: {
        excludedNames: [],
        includedNames: ["column_1", "column_2"],
        mode: "strict",
      },
    };
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.8,
          id: "rec_headered_columns",
          patches: [{ op: "replace", path: "/input/columns", value: ["id", "status"] }],
          reasoningSummary: "Bad headered column patch.",
          title: "Bad headered column patch",
        }),
      "only valid for headerless input",
    );
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.8,
          id: "rec_bad",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["missing"] }],
          reasoningSummary: "Bad key.",
          title: "Bad key",
        }),
      "unknown schema names",
    );
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.8,
          id: "rec_strict_exclusions",
          patches: [{ op: "replace", path: "/schema/excludedNames", value: ["status"] }],
          reasoningSummary: "Strict mode cannot carry exclusions.",
          title: "Bad strict exclusions",
        }),
      "--exclude-columns requires --schema-mode union-by-name",
    );
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.8,
          id: "rec_unknown_exclusion",
          patches: [
            { op: "replace", path: "/schema/mode", value: "union-by-name" },
            { op: "replace", path: "/schema/excludedNames", value: ["missing"] },
          ],
          reasoningSummary: "Missing is not an accepted schema name.",
          title: "Bad unknown exclusion",
        }),
      "unknown schema names",
    );
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(headerlessPlan, {
          confidence: 0.8,
          id: "rec_headerless_union",
          patches: [{ op: "replace", path: "/schema/mode", value: "union-by-name" }],
          reasoningSummary: "Headerless input cannot use union-by-name.",
          title: "Bad headerless schema mode",
        }),
      "--schema-mode union-by-name cannot be used with --no-header",
    );
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.8,
          id: "rec_included_names",
          patches: [
            { op: "replace", path: "/schema/includedNames" as never, value: ["id", "status"] },
          ],
          reasoningSummary: "Included names are not an executable patch.",
          title: "Bad included names patch",
        }),
      "path must be one of",
    );
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.8,
          id: "rec_conflict",
          patches: [
            { op: "replace", path: "/duplicates/policy", value: "report" },
            { op: "replace", path: "/duplicates/policy", value: "reject" },
          ],
          reasoningSummary: "Conflicting policy.",
          title: "Conflicting policy",
        }),
      "duplicate patch path",
    );
  });

  test("applies accepted recommendations into a derived stack plan with new payload lineage", () => {
    const plan = createPlan();
    const report = createReport(plan);
    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_unique_id" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.metadata.payloadId).not.toBe(plan.metadata.payloadId);
    expect(nextPlan.metadata.derivedFromPayloadId).toBe(plan.metadata.payloadId);
    expect(nextPlan.metadata.acceptedRecommendationIds).toEqual(["rec_unique_id"]);
    expect(nextPlan.metadata.recommendationDecisions).toEqual([
      {
        decision: "accepted",
        recommendationId: "rec_unique_id",
        reportArtifactId: report.metadata.artifactId,
      },
    ]);
    expect(nextPlan.duplicates.uniqueBy).toEqual(["id"]);
  });

  test("records edited recommendations without treating them as accepted", () => {
    const plan = createPlan();
    const report = createReport(plan);
    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [
        {
          decision: "edited",
          patches: [{ op: "replace", path: "/duplicates/policy", value: "reject" }],
          recommendationId: "rec_report_duplicates",
        },
      ],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.metadata.acceptedRecommendationIds).toEqual([]);
    expect(nextPlan.metadata.recommendationDecisions).toEqual([
      {
        decision: "edited",
        recommendationId: "rec_report_duplicates",
        reportArtifactId: report.metadata.artifactId,
      },
    ]);
    expect(nextPlan.duplicates.policy).toBe("reject");
  });

  test("rejects conflicting accepted recommendation batches", () => {
    const plan = createPlan();
    const diagnostics = computeDataStackDiagnostics({
      header: plan.schema.includedNames,
      matchedFileCount: 1,
      rows: [
        ["1", "active", "north"],
        ["2", "paused", "south"],
      ],
    });
    const report = createDataStackCodexReportArtifact({
      diagnostics,
      now: new Date("2026-04-26T00:01:00.000Z"),
      plan,
      recommendations: [
        {
          confidence: 0.7,
          id: "rec_report_duplicates",
          patches: [{ op: "replace", path: "/duplicates/policy", value: "report" }],
          reasoningSummary: "Report duplicates.",
          title: "Report duplicates",
        },
        {
          confidence: 0.8,
          id: "rec_reject_duplicates",
          patches: [{ op: "replace", path: "/duplicates/policy", value: "reject" }],
          reasoningSummary: "Reject duplicates.",
          title: "Reject duplicates",
        },
      ],
      uid: "eeeeffff",
    });

    expectCliError(
      () =>
        applyDataStackCodexRecommendationDecisions({
          decisions: [
            { decision: "accepted", recommendationId: "rec_report_duplicates" },
            { decision: "accepted", recommendationId: "rec_reject_duplicates" },
          ],
          now: new Date("2026-04-26T00:02:00.000Z"),
          plan,
          report,
        }),
      "Conflicting data stack Codex patches",
    );
  });

  test("rejects duplicate recommendation ids while creating a report", () => {
    const plan = createPlan();
    const diagnostics = computeDataStackDiagnostics({
      header: plan.schema.includedNames,
      matchedFileCount: 1,
      rows: [
        ["1", "active", "north"],
        ["2", "paused", "south"],
      ],
    });

    expectCliError(
      () =>
        createDataStackCodexReportArtifact({
          diagnostics,
          now: new Date("2026-04-26T00:01:00.000Z"),
          plan,
          recommendations: [
            {
              confidence: 0.7,
              id: "rec_duplicate",
              patches: [{ op: "replace", path: "/duplicates/policy", value: "report" }],
              reasoningSummary: "Report duplicates.",
              title: "Report duplicates",
            },
            {
              confidence: 0.8,
              id: "rec_duplicate",
              patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
              reasoningSummary: "Use id.",
              title: "Use id",
            },
          ],
          uid: "ffffeeee",
        }),
      "duplicate recommendation id",
    );
  });

  test("preserves existing recommendation lineage across a second apply pass", () => {
    const plan = createPlan();
    const report = createReport(plan);
    const firstPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_unique_id" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });
    const secondPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [
        {
          decision: "edited",
          patches: [{ op: "replace", path: "/duplicates/policy", value: "reject" }],
          recommendationId: "rec_report_duplicates",
        },
      ],
      now: new Date("2026-04-26T00:03:00.000Z"),
      plan: firstPlan,
      report,
    });

    expect(secondPlan.metadata.acceptedRecommendationIds).toEqual(["rec_unique_id"]);
    expect(secondPlan.metadata.recommendationDecisions).toEqual([
      {
        decision: "accepted",
        recommendationId: "rec_unique_id",
        reportArtifactId: report.metadata.artifactId,
      },
      {
        decision: "edited",
        recommendationId: "rec_report_duplicates",
        reportArtifactId: report.metadata.artifactId,
      },
    ]);
    expect(secondPlan.metadata.derivedFromPayloadId).toBe(firstPlan.metadata.payloadId);
    expect(secondPlan.duplicates.uniqueBy).toEqual(["id"]);
    expect(secondPlan.duplicates.policy).toBe("reject");
  });
});
