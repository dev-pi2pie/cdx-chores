import { describe, expect, test } from "bun:test";

import {
  applyDataStackCodexRecommendationDecisions,
  createDataStackCodexReportArtifact,
} from "../../src/cli/data-stack/codex-report";
import { computeDataStackDiagnostics } from "../../src/cli/data-stack/diagnostics";
import type { DataStackPlanArtifact } from "../../src/cli/data-stack/plan";
import {
  createDataStackCodexTestPlan,
  createDataStackCodexTestReport,
  createDataStackCodexUnionModePlan,
  expectCliError,
} from "../helpers/data-stack-test-utils";

describe("data stack Codex report recommendation application", () => {
  test("applies schema exclusions to included names in derived plans", () => {
    const plan = createDataStackCodexUnionModePlan();
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
          patches: [{ op: "replace", path: "/schema/excludedNames", value: ["status"] }],
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
    const plan = createDataStackCodexUnionModePlan();
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

  test("rejects exclusion replacements that remove existing exclusions", () => {
    const plan: DataStackPlanArtifact = {
      ...createDataStackCodexTestPlan(),
      schema: {
        excludedNames: ["noise"],
        includedNames: ["id", "status"],
        mode: "union-by-name",
      },
    };
    const report = createDataStackCodexTestReport(plan);

    expectCliError(
      () =>
        applyDataStackCodexRecommendationDecisions({
          decisions: [
            {
              decision: "edited",
              patches: [{ op: "replace", path: "/schema/excludedNames", value: [] }],
              recommendationId: "rec_unique_id",
            },
          ],
          now: new Date("2026-04-26T00:02:00.000Z"),
          plan,
          report,
        }),
      "must keep existing excluded schema names",
    );
  });

  test("applies additive exclusion replacements from the full schema basis", () => {
    const plan: DataStackPlanArtifact = {
      ...createDataStackCodexTestPlan(),
      duplicates: {
        duplicateKeyConflicts: 0,
        exactDuplicateRows: 0,
        policy: "preserve",
        uniqueBy: ["status"],
      },
      schema: {
        excludedNames: ["noise"],
        includedNames: ["id", "status"],
        mode: "union-by-name",
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
          confidence: 0.8,
          id: "rec_schema_exclusions",
          patches: [{ op: "replace", path: "/schema/excludedNames", value: ["noise", "status"] }],
          reasoningSummary: "Exclude sparse status values while keeping existing exclusions.",
          title: "Exclude status in union mode",
        },
      ],
      uid: "bbbbffff",
    });

    const nextPlan = applyDataStackCodexRecommendationDecisions({
      decisions: [{ decision: "accepted", recommendationId: "rec_schema_exclusions" }],
      now: new Date("2026-04-26T00:02:00.000Z"),
      plan,
      report,
    });

    expect(nextPlan.duplicates.uniqueBy).toEqual([]);
    expect(nextPlan.schema).toEqual({
      excludedNames: ["noise", "status"],
      includedNames: ["id"],
      mode: "union-by-name",
    });
  });

  test("validates unique keys against patched headerless input columns", () => {
    const plan: DataStackPlanArtifact = {
      ...createDataStackCodexTestPlan(),
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
      ...createDataStackCodexTestPlan(),
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

  test("applies accepted recommendations into a derived stack plan with new payload lineage", () => {
    const plan = createDataStackCodexTestPlan();
    const report = createDataStackCodexTestReport(plan);
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
    const plan = createDataStackCodexTestPlan();
    const report = createDataStackCodexTestReport(plan);
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
    const plan = createDataStackCodexTestPlan();
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

  test("preserves existing recommendation lineage across a second apply pass", () => {
    const plan = createDataStackCodexTestPlan();
    const report = createDataStackCodexTestReport(plan);
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
