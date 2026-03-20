import { describe, expect, test } from "bun:test";

import { REPO_ROOT } from "./helpers/cli-test-utils";
import { runInteractiveHarness } from "./helpers/interactive-harness";

describe("interactive mode routing", () => {
  test("routes the doctor flow from the root menu", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([{ name: "doctor", options: { json: true } }]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "confirm:Output as JSON?",
    ]);
    expect(result.pathCalls).toHaveLength(0);
  });

  test("shows the broadened data menu copy and includes data extract plus data query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.selectChoicesByMessage["Choose a command"]).toContainEqual({
      name: "data",
      value: "data",
      description: "Preview and convert tabular data",
    });
    expect(result.selectChoicesByMessage["Choose a data command"]?.map((choice) => choice.value)).toEqual([
      "data:preview",
      "data:extract",
      "data:query",
      "data:parquet-preview",
      "data:convert",
      "back",
      "cancel",
    ]);
  });

  test("routes interactive data convert through shared path prompt context", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:convert", "tsv"],
      requiredPathQueue: ["fixtures/input.json"],
      optionalPathQueue: [undefined],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:json-to-tsv",
        options: {
          input: "fixtures/input.json",
          output: null,
          overwrite: true,
        },
      },
    ]);
    expect(result.pathCalls[0]).toMatchObject({
      kind: "required",
      message: "Input CSV, TSV, or JSON file",
      options: {
        kind: "file",
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        cwd: REPO_ROOT,
      },
    });
    expect(result.stderr).toContain("Detected source format: json");
  });

  test("routes interactive data query manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "users", "manual", "table"],
      requiredPathQueue: ["fixtures/query.sqlite"],
      inputQueue: ["select id, name from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.sqlite",
          inputFormat: "sqlite",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          source: "users",
          sql: "select id, name from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Use detected input format: sqlite?",
      "select:Choose a SQLite source",
      "select:Choose mode",
      "input:SQL query",
      "confirm:Execute this SQL?",
      "select:Output mode",
      "input:Rows to show (optional)",
    ]);
  });

  test("routes interactive data extract through shared extraction execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          output: "fixtures/query.json",
          overwrite: false,
        },
      },
    ]);
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output JSON file",
      options: expect.objectContaining({
        customMessage: "Custom JSON output path",
        defaultHint: "fixtures/query.csv.json",
        kind: "file",
      }),
    });
    expect(result.stderr).toContain("Extraction write summary");
    expect(result.stderr).toContain("- output format: JSON");
  });

  test("lets interactive data extract stop before materialization at the final write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stderr).toContain("Extraction write summary");
    expect(result.stderr).toContain("Skipped extraction write.");
  });

  test("prompts for Excel range before SQL authoring and carries it into execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Summary", "manual", "table"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["A1:B3", "select * from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "excel",
      dataQuerySources: ["Summary"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedRange: "A1:B3",
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.xlsx",
          inputFormat: "excel",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          range: "A1:B3",
          rows: 10,
          source: "Summary",
          sql: "select * from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Use detected input format: excel?",
      "select:Choose an Excel sheet",
      "input:Excel range (optional, e.g. A1:Z99)",
      "select:Choose mode",
      "input:SQL query",
      "confirm:Execute this SQL?",
      "select:Output mode",
      "input:Rows to show (optional)",
    ]);
    expect(result.stderr).toContain("This step changes how the source is interpreted as a table.");
    expect(result.stderr).toContain("Range:");
  });

  test("routes interactive data query formal-guide mode and builds deterministic SQL", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "count", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "status", "status:asc", "5"],
      confirmQueue: [true, false, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 5,
          source: undefined,
          sql: 'select "status", count(*) as row_count\nfrom file\ngroup by "status"\norder by "status" asc',
        },
      },
    ]);
  });

  test("rejects aggregate formal-guide order-by columns outside the result set", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "count", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "status:asc", "row_count:desc", "5"],
      confirmQueue: [true, false, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Order by (column[:asc|desc], comma-separated, optional)",
      value: "status:asc",
      error: "Unknown order-by column: status.",
    });
    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 5,
          source: undefined,
          sql: 'select count(*) as row_count\nfrom file\norder by "row_count" desc',
        },
      },
    ]);
  });

  test("routes Codex Assistant through the default single-line intent prompt", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, true, false],
      inputQueue: ["count rows by status"],
      dataQueryDetectedFormat: "csv",
      dataQueryCodexDraft: {
        sql: 'select "status", count(*) as row_count from file group by "status"',
        reasoningSummary: "Counts rows by status.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:codex-draft",
        options: {
          format: "csv",
          intent: "count rows by status",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: true,
          output: undefined,
          overwrite: undefined,
          pretty: false,
          rows: undefined,
          source: undefined,
          sql: 'select "status", count(*) as row_count from file group by "status"',
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Use multiline editor?",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Describe the query intent:",
    );
  });

  test("keeps interactive query metadata off stdout for json output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, true, false],
      dataQueryActionStdout: '[{"id":1}]\n',
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [{ name: "id", type: "BIGINT" }],
        sampleRows: [{ id: "1" }],
        truncated: false,
      },
    });

    expect(result.stdout).toBe('[{"id":1}]\n');
    expect(result.stderr).toContain("Input:");
    expect(result.stderr).toContain("Schema:");
    expect(result.stderr).toContain("Sample Rows:");
    expect(result.stderr).toContain("SQL:");
    expect(result.stderr).toContain("select id from file");
  });

  test("prints DuckDB install remediation command for interactive query extension failures", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["data", "data:query", "Summary", "manual", "table"],
        requiredPathQueue: ["fixtures/query.xlsx"],
        inputQueue: ["", "select id from file", "10"],
        confirmQueue: [true, true],
        dataQueryActionErrorCode: "DUCKDB_EXTENSION_UNAVAILABLE",
        dataQueryActionErrorMessage:
          'Excel query requires the DuckDB excel extension, and it is not installed in the current environment. Install it explicitly in DuckDB, then retry.',
        dataQueryDetectedFormat: "excel",
        dataQuerySources: ["Summary"],
        dataQueryIntrospection: {
          columns: [{ name: "id", type: "BIGINT" }],
          sampleRows: [{ id: "1" }],
          selectedSource: "Summary",
          truncated: false,
        },
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("requires the DuckDB excel extension");
    expect(result.stderr).toContain(
      "Install the missing DuckDB extension with: cdx-chores data duckdb extension install excel",
    );
  });

  test("warns about suspicious raw Excel schemas before SQL authoring and supports manual range recovery", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Summary", "range", "manual", "table"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["", "A1:B3", "select * from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospectionQueue: [
        {
          columns: [{ name: "Quarterly Operations Report", type: "VARCHAR" }],
          sampleRows: [],
          selectedSource: "Summary",
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1", name: "Ada" }],
          selectedRange: "A1:B3",
          selectedSource: "Summary",
          truncated: false,
        },
      ],
      dataQuerySources: ["Summary"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.xlsx",
          inputFormat: "excel",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          range: "A1:B3",
          rows: 10,
          source: "Summary",
          sql: "select * from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose how to continue",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Excel range (required, e.g. A1:Z99)",
    );
    expect(result.stderr).toContain("Sheet shape warning: current Excel sheet shape looks suspicious.");
    expect(result.stderr).toContain("Accepted source shape: --range A1:B3");
    expect(result.stderr).toContain("Re-inspecting shaped source before SQL authoring.");
  });

  test("warns about suspicious raw Excel schemas before SQL authoring and supports reviewed Codex shape recovery", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Summary", "suggest", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["", "select * from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospectionQueue: [
        {
          columns: [{ name: "Quarterly Operations Report", type: "VARCHAR" }],
          sampleRows: [],
          selectedSource: "Summary",
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1", name: "Ada" }],
          selectedHeaderRow: 7,
          selectedRange: "A1:B3",
          selectedSource: "Summary",
          truncated: false,
        },
      ],
      dataQuerySources: ["Summary"],
      dataSourceShapeSuggestion: {
        reasoningSummary: "The real table starts at row 7 across the first two columns.",
        shape: {
          range: "A1:B3",
          headerRow: 7,
        },
      },
    });

    expect(result.actionCalls).toContainEqual({
      name: "data:source-shape-suggest",
      options: {
        selectedSource: "Summary",
        sheetName: "Summary",
      },
    });
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        headerRow: 7,
        input: "fixtures/query.xlsx",
        inputFormat: "excel",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        range: "A1:B3",
        rows: 10,
        source: "Summary",
        sql: "select * from file order by id",
      },
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Source shape review",
    );
    expect(result.stdout).toContain("Inspecting worksheet structure");
    expect(result.stdout).toContain("Waiting for Codex source-shape suggestions");
    expect(result.stderr).toContain("Suggested source shape");
    expect(result.stderr).toContain("--header-row 7");
    expect(result.stderr).toContain("Accepted source shape: --range A1:B3 --header-row 7");
  });

  test("warns for collapsed merged-sheet whole-sheet views even when one visible column still has sample rows", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "Sheet1", "continue", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: [""],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospection: {
        columns: [{ name: "Hello_This_Is_the_merged", type: "VARCHAR" }],
        sampleRows: [
          { Hello_This_Is_the_merged: "ID" },
          { Hello_This_Is_the_merged: "78.0" },
          { Hello_This_Is_the_merged: "21.0" },
        ],
        selectedSource: "Sheet1",
        truncated: false,
      },
      dataQuerySources: ["Sheet1"],
      xlsxSheetSnapshot: {
        mergedRanges: ["A1:C1"],
        usedRange: "A1:C5",
      },
    });

    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose how to continue",
    );
    expect(result.stderr).toContain(
      "Whole-sheet inspection collapsed a merged or multi-column worksheet into one visible column.",
    );
    expect(result.actionCalls).toEqual([]);
  });

  test("re-prompts the shape warning after a Codex source-shape failure instead of falling straight into extraction", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "Sheet1", "suggest", "continue", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: [""],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false],
      dataQueryDetectedFormat: "excel",
      dataQueryIntrospection: {
        columns: [{ name: "RAW_TITLE", type: "DOUBLE" }],
        sampleRows: [],
        selectedSource: "Sheet1",
        truncated: false,
      },
      dataQuerySources: ["Sheet1"],
      dataSourceShapeSuggestionErrorMessage: "schema rejected",
    });

    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Choose how to continue"),
    ).toHaveLength(2);
    expect(result.stderr).toContain("Codex source-shape suggestion failed: schema rejected");
    expect(result.actionCalls).toEqual([
      {
        name: "data:source-shape-suggest",
        options: {
          selectedSource: "Sheet1",
          sheetName: "Sheet1",
        },
      },
    ]);
  });

  test("accepts all interactive header suggestions and re-inspects before SQL authoring", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id, status from file order by id", "10"],
      confirmQueue: [true, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1001", inferredType: "BIGINT" },
        { from: "column_2", to: "status", sample: "active", inferredType: "VARCHAR" },
      ],
      dataQueryIntrospectionQueue: [
        {
          columns: [
            { name: "column_1", type: "BIGINT" },
            { name: "column_2", type: "VARCHAR" },
          ],
          sampleRows: [{ column_1: "1001", column_2: "active" }],
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "status", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1001", status: "active" }],
          truncated: false,
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:header-suggest",
        options: {
          format: "csv",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          headerMappings: [
            { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
            { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
          ],
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select id, status from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Review semantic header suggestions before SQL?",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Header suggestion review",
    );
    expect(result.stdout).toContain("Waiting for Codex header suggestions");
    expect(result.stderr).toContain("Accepted header mappings. Re-inspecting shaped source before SQL authoring.");
  });

  test("supports editing one interactive header suggestion before acceptance", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "edit", "column_2", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["state", "select id, state from file order by id", "10"],
      confirmQueue: [true, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1001", inferredType: "BIGINT" },
        { from: "column_2", to: "status", sample: "active", inferredType: "VARCHAR" },
      ],
      dataQueryIntrospectionQueue: [
        {
          columns: [
            { name: "column_1", type: "BIGINT" },
            { name: "column_2", type: "VARCHAR" },
          ],
          sampleRows: [{ column_1: "1001", column_2: "active" }],
          truncated: false,
        },
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "state", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1001", state: "active" }],
          truncated: false,
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:header-suggest",
        options: {
          format: "csv",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          headerMappings: [
            { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
            { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "state" },
          ],
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select id, state from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose one mapping to edit",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Header for column_2",
    );
  });

  test("supports keeping generated names after interactive header suggestions are shown", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "keep", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select column_1, column_2 from file order by column_1", "10"],
      confirmQueue: [true, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryHeaderSuggestions: [
        { from: "column_1", to: "id", sample: "1001", inferredType: "BIGINT" },
        { from: "column_2", to: "status", sample: "active", inferredType: "VARCHAR" },
      ],
      dataQueryIntrospection: {
        columns: [
          { name: "column_1", type: "BIGINT" },
          { name: "column_2", type: "VARCHAR" },
        ],
        sampleRows: [{ column_1: "1001", column_2: "active" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:header-suggest",
        options: {
          format: "csv",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select column_1, column_2 from file order by column_1",
        },
      },
    ]);
  });

  test("routes Codex Assistant through the multiline editor when requested", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, true, true, true, false],
      editorQueue: [
        "# Query context for Codex drafting.\n# Logical table: file\n# Write plain intent below.\ncount rows\nby status",
      ],
      dataQueryDetectedFormat: "csv",
      dataQueryCodexDraft: {
        sql: 'select "status", count(*) as row_count from file group by "status"',
        reasoningSummary: "Counts rows by status.",
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:codex-draft",
        options: {
          format: "csv",
          intent: "count rows by status",
          selectedSource: undefined,
        },
      },
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: true,
          output: undefined,
          overwrite: undefined,
          pretty: false,
          rows: undefined,
          source: undefined,
          sql: 'select "status", count(*) as row_count from file group by "status"',
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "editor:Describe the query intent:",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Send this intent to Codex drafting?",
    );
    const editorPrompt = result.promptCalls.find(
      (call) => call.kind === "editor" && call.message === "Describe the query intent:",
    );
    expect(editorPrompt?.postfix).toBe(".md");
    expect(editorPrompt?.defaultValue).toContain("# Logical table: file");
    expect(editorPrompt?.defaultValue).toContain("# Format: csv");
    expect(editorPrompt?.defaultValue).toContain("# Schema:");
    expect(editorPrompt?.defaultValue).toContain("# Sample rows:");
    expect(editorPrompt?.defaultValue).toContain("# Write plain intent below. Comment lines starting with # are ignored.");
    expect(result.stderr).toContain("Intent: count rows by status");
  });

  test("keeps Codex intent preview off stdout before json output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, true, true, true, false],
      editorQueue: [
        "# Query context for Codex drafting.\n# Logical table: file\ncount rows\nby status",
      ],
      dataQueryActionStdout: '[{"status":"active","row_count":1}]\n',
      dataQueryDetectedFormat: "csv",
      dataQueryCodexDraft: {
        sql: 'select "status", count(*) as row_count from file group by "status"',
        reasoningSummary: "Counts rows by status.",
      },
    });

    expect(result.stdout).toBe('[{"status":"active","row_count":1}]\n');
    expect(result.stderr).toContain("Intent: count rows by status");
    expect(result.stderr).toContain("SQL:");
    expect(result.stderr).toContain('select "status", count(*) as row_count from file group by "status"');
  });

  test("reopens the multiline editor until the cleaned intent is confirmed", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, true, false, true, true, true, false],
      editorQueue: [
        "# Query context for Codex drafting.\ncount rows\nby status",
        "# Query context for Codex drafting.\ncount active rows\nby status",
      ],
      dataQueryDetectedFormat: "csv",
      dataQueryCodexDraft: {
        sql: 'select "status", count(*) as row_count from file where "status" = \'active\' group by "status"',
        reasoningSummary: "Counts active rows by status.",
      },
    });

    expect(
      result.promptCalls.filter((call) => call.kind === "editor" && call.message === "Describe the query intent:"),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
      name: "data:query:codex-draft",
      options: {
        format: "csv",
        intent: "count active rows by status",
        selectedSource: undefined,
      },
    });
    const editorPrompts = result.promptCalls.filter(
      (call) => call.kind === "editor" && call.message === "Describe the query intent:",
    );
    expect(editorPrompts[1]?.defaultValue).toContain("count rows by status");
  });

  test("re-prompts file output when overwrite is declined", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "file", "file"],
      requiredPathQueue: ["fixtures/query.csv", "reports/existing.json", "reports/fresh.json"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, true, false, false],
      existingPaths: ["reports/existing.json"],
      dataQueryDetectedFormat: "csv",
    });

    expect(
      result.pathCalls.filter((call) => call.kind === "required" && call.message === "Output file path"),
    ).toHaveLength(2);
    expect(result.stderr).toContain("Output file already exists:");
    expect(result.actionCalls).toHaveLength(2);
    expect(result.actionCalls[0]).toMatchObject({
      name: "data:query",
      options: {
        input: "fixtures/query.csv",
        inputFormat: "csv",
        output: "reports/existing.json",
        overwrite: false,
        pretty: false,
        sql: "select id from file",
      },
    });
    expect(result.actionCalls[1]).toMatchObject({
      name: "data:query",
      options: {
        input: "fixtures/query.csv",
        inputFormat: "csv",
        output: "reports/fresh.json",
        overwrite: false,
        pretty: false,
        sql: "select id from file",
      },
    });
  });

  test("routes data preview through optional interactive prompts", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false],
      inputQueue: ["15", "", "id,status", ""],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: 15,
          offset: undefined,
          columns: ["id", "status"],
          contains: undefined,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Treat CSV/TSV input as headerless?",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("routes data preview in headerless mode for CSV input", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [true],
      inputQueue: ["", "", "", ""],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: undefined,
          noHeader: true,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Treat CSV/TSV input as headerless?",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
    ]);
  });

  test("routes interactive data convert to JSON with JSON-only pretty prompt", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:convert", "json"],
      requiredPathQueue: ["fixtures/table.tsv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:tsv-to-json",
        options: {
          input: "fixtures/table.tsv",
          output: null,
          overwrite: false,
          pretty: true,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "select:Convert to",
      "confirm:Pretty-print JSON?",
      "confirm:Overwrite if exists?",
    ]);
    expect(result.pathCalls).toContainEqual({
      kind: "hint",
      inputPath: "fixtures/table.tsv",
      nextExtension: ".json",
    });
    expect(result.stderr).toContain("Detected source format: tsv");
  });

  test("interactive data convert excludes the detected source format from target choices", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:convert", "json"],
      requiredPathQueue: ["fixtures/table.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false],
    });

    expect(result.selectChoicesByMessage["Convert to"]?.map((choice) => choice.value)).toEqual([
      "tsv",
      "json",
    ]);
  });

  test("interactive data convert does not ask for pretty printing on delimited output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:convert", "csv"],
      requiredPathQueue: ["fixtures/table.tsv"],
      optionalPathQueue: [undefined],
      confirmQueue: [false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:tsv-to-csv",
        options: {
          input: "fixtures/table.tsv",
          output: null,
          overwrite: false,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "confirm:Pretty-print JSON?",
    );
  });

  test("routes parquet preview through its separate interactive prompts", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:parquet-preview"],
      requiredPathQueue: ["fixtures/table.parquet"],
      inputQueue: ["25", "5", "id,status"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:parquet-preview",
        options: {
          input: "fixtures/table.parquet",
          rows: 25,
          offset: 5,
          columns: ["id", "status"],
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("routes data preview with a single contains filter from interactive mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false, false],
      inputQueue: ["", "", "", "status:active"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active"],
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Treat CSV/TSV input as headerless?",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
      "confirm:Add another contains filter?",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("routes data preview with repeated contains filters from interactive mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.json"],
      inputQueue: ["", "", "", "status:active", "region:tw"],
      confirmQueue: [true, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.json",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active", "region:tw"],
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
      "confirm:Add another contains filter?",
      "input:Another contains filter (column:keyword)",
      "confirm:Add another contains filter?",
    ]);
    expect(result.validationCalls).toEqual([]);
  });

  test("re-prompts malformed contains syntax locally before running data preview", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false, false],
      inputQueue: ["", "", "", "status", "status:active"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active"],
        },
      },
    ]);
    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Contains filter (column:keyword, optional)",
      value: "status",
      error: 'Invalid --contains value "status": missing \':\' separator.',
    });
  });

  test("re-prompts unknown contains columns locally before running data preview", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      requiredPathQueue: ["fixtures/table.csv"],
      inputQueue: ["", "", "", "owner:ada", "status:active"],
      confirmQueue: [false, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: ["status:active"],
        },
      },
    ]);
    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Contains filter (column:keyword, optional)",
      value: "owner:ada",
      error: "Unknown columns: owner",
    });
  });

  test("routes a markdown flow through file output options", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "md:frontmatter-to-json", "file", "data-only"],
      requiredPathQueue: ["fixtures/doc.md"],
      optionalPathQueue: ["fixtures/doc.frontmatter.json"],
      confirmQueue: [true, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "md:frontmatter-to-json",
        options: {
          input: "fixtures/doc.md",
          toStdout: false,
          output: "fixtures/doc.frontmatter.json",
          overwrite: false,
          pretty: true,
          dataOnly: true,
        },
      },
    ]);
  });

  test("routes a rename flow through apply", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:apply"],
      requiredPathQueue: ["plans/rename.csv"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:apply",
        options: {
          csv: "plans/rename.csv",
          autoClean: true,
        },
      },
    ]);
  });

  test("routes a video flow through gif generation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["video", "video:gif"],
      requiredPathQueue: ["fixtures/input.mp4"],
      optionalPathQueue: ["fixtures/output.gif"],
      inputQueue: ["320", "12"],
      confirmQueue: [false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "video:gif",
        options: {
          input: "fixtures/input.mp4",
          output: "fixtures/output.gif",
          width: 320,
          fps: 12,
          overwrite: false,
        },
      },
    ]);
  });

  test("throws when a handler receives an unknown action", () => {
    const result = runInteractiveHarness({ mode: "invalid-data-action" }, { allowFailure: true });

    expect(result.error).toBe("Unhandled interactive action: data:unknown");
  });
});
