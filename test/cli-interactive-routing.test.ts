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

  test("shows the broadened data menu copy and includes data query", () => {
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
      "data:query",
      "data:parquet-preview",
      "data:json-to-csv",
      "data:csv-to-json",
      "back",
      "cancel",
    ]);
  });

  test("routes a data flow and passes shared path prompt context", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:json-to-csv"],
      requiredPathQueue: ["fixtures/input.json"],
      optionalPathQueue: [undefined],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:json-to-csv",
        options: {
          input: "fixtures/input.json",
          output: null,
          overwrite: true,
        },
      },
    ]);
    expect(result.pathCalls[0]).toMatchObject({
      kind: "required",
      message: "Input JSON file",
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
      "input:Describe the query intent",
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
      "editor:Describe the query intent",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Send this intent to Codex drafting?",
    );
    const editorPrompt = result.promptCalls.find(
      (call) => call.kind === "editor" && call.message === "Describe the query intent",
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
      result.promptCalls.filter((call) => call.kind === "editor" && call.message === "Describe the query intent"),
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
      (call) => call.kind === "editor" && call.message === "Describe the query intent",
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
      "input:Rows to show (optional)",
      "input:Row offset (optional)",
      "input:Columns to show (comma-separated, optional)",
      "input:Contains filter (column:keyword, optional)",
    ]);
    expect(result.validationCalls).toEqual([]);
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
      inputQueue: ["", "", "", "status:active"],
      confirmQueue: [false],
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
      inputQueue: ["", "", "", "status", "status:active"],
      confirmQueue: [false],
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
      confirmQueue: [false],
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
