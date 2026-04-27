import { describe, expect, test } from "bun:test";

import { DATA_STACK_CODEX_OUTPUT_SCHEMA } from "../../src/cli/data-stack/codex-assist";
import {
  createDataStackCodexReportArtifact,
  validateDataStackCodexRecommendation,
} from "../../src/cli/data-stack/codex-report";
import { computeDataStackDiagnostics } from "../../src/cli/data-stack/diagnostics";
import type { DataStackPlanArtifact } from "../../src/cli/data-stack/plan";
import {
  createDataStackCodexTestPlan,
  createDataStackCodexUnionModePlan,
  expectCliError,
} from "../helpers/data-stack-test-utils";

describe("data stack Codex report validation", () => {
  test("validates replace patches against supported stack-plan fields", () => {
    const plan = createDataStackCodexTestPlan();
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

  test("accepts schema-mode recommendations only when they keep the existing mode", () => {
    const plan = createDataStackCodexTestPlan();
    const recommendation = validateDataStackCodexRecommendation(plan, {
      confidence: 0.72,
      id: "rec_schema_mode",
      patches: [{ op: "replace", path: "/schema/mode", value: "strict" }],
      reasoningSummary: "Keep strict schema handling.",
      title: "Keep strict mode",
    });

    expect(recommendation.patches).toEqual([
      { op: "replace", path: "/schema/mode", value: "strict" },
    ]);
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(plan, {
          confidence: 0.72,
          id: "rec_schema_union",
          patches: [{ op: "replace", path: "/schema/mode", value: "union-by-name" }],
          reasoningSummary: "Sources show deterministic schema drift.",
          title: "Use union by name",
        }),
      "cannot change schema mode",
    );

    const unionPlan = createDataStackCodexUnionModePlan();
    expectCliError(
      () =>
        validateDataStackCodexRecommendation(unionPlan, {
          confidence: 0.72,
          id: "rec_schema_strict",
          patches: [{ op: "replace", path: "/schema/mode", value: "strict" }],
          reasoningSummary: "Sources now look strict.",
          title: "Use strict mode",
        }),
      "cannot change schema mode",
    );
  });

  test("accepts schema exclusions only when the resulting schema state is executable", () => {
    const plan = createDataStackCodexUnionModePlan();
    const recommendation = validateDataStackCodexRecommendation(plan, {
      confidence: 0.8,
      id: "rec_schema_exclusions",
      patches: [{ op: "replace", path: "/schema/excludedNames", value: ["status"] }],
      reasoningSummary: "Union by name can exclude sparse status values.",
      title: "Exclude status in union mode",
    });

    expect(recommendation.patches).toEqual([
      { op: "replace", path: "/schema/excludedNames", value: ["status"] },
    ]);
  });

  test("rejects headerless column patches that leave unknown unique keys", () => {
    const plan: DataStackPlanArtifact = {
      ...createDataStackCodexTestPlan(),
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
    const plan = createDataStackCodexTestPlan();
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
        validateDataStackCodexRecommendation(createDataStackCodexUnionModePlan(), {
          confidence: 0.8,
          id: "rec_unknown_exclusion",
          patches: [{ op: "replace", path: "/schema/excludedNames", value: ["missing"] }],
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
      "cannot change schema mode",
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

  test("rejects duplicate recommendation ids while creating a report", () => {
    const plan = createDataStackCodexTestPlan();
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
});
