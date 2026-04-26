import { describe, expect, test } from "bun:test";

import { REPO_ROOT } from "./helpers/cli-test-utils";
import { runInteractiveHarness } from "./helpers/interactive-harness";
import { stripAnsi } from "./cli-actions-data-preview/helpers";

const DEFAULT_DATA_STACK_TIMESTAMP = "20260225T000000Z";

function dataStackDefaultOutputMatcher(
  timestamp: string,
  extension: string,
): ReturnType<typeof expect.stringMatching> {
  return expect.stringMatching(new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`));
}

function dataStackDefaultPathPattern(timestamp: string, extension: string): RegExp {
  return new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`);
}

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

  test("shows the broadened data menu copy and includes data stack plus query and extract", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stackPlanWrites).toHaveLength(0);
    expect(result.selectChoicesByMessage["Choose a command"]).toContainEqual({
      name: "data",
      value: "data",
      description: "Preview and convert tabular data",
    });
    expect(
      result.selectChoicesByMessage["Choose a data command"]?.map((choice) => choice.value),
    ).toEqual([
      "data:preview",
      "data:extract",
      "data:stack",
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
      selectQueue: ["data", "data:query", "single-source", "users", "manual", "table"],
      nowIsoString: "2026-03-30T00:00:00.300Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
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
    const plainStderr = stripAnsi(result.stderr);
    expect(plainStderr).toContain("Tip: Manual is best for joins or custom SQL.");
    expect(plainStderr.match(/Tip:/g) ?? []).toHaveLength(1);
    expect(plainStderr.trimStart().startsWith("Tip: Manual is best for joins or custom SQL.")).toBe(
      true,
    );
    expect(plainStderr.indexOf("Tip: Manual is best for joins or custom SQL.")).toBeLessThan(
      plainStderr.indexOf("Input:"),
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a data command",
      "confirm:Use detected input format: sqlite?",
      "select:Choose query scope",
      "select:Choose a SQLite source",
      "select:Choose mode",
      "input:SQL query",
      "confirm:Execute this SQL?",
      "select:Output mode",
      "input:Rows to show (optional)",
    ]);
  });

  test("routes interactive data query workspace manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "table"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      inputQueue: [
        "users",
        "active",
        "select users.id, active.name from users join active on users.id = active.id order by users.id",
        "10",
      ],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
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
          relations: [
            { alias: "users", source: "users" },
            { alias: "active", source: "active_users" },
          ],
          rows: 10,
          sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose query scope",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "checkbox:Choose SQLite relations for the workspace",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Relation name for users",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Relation name for active_users",
    );
    expect(result.stderr).toContain("Workspace relations: users, active");
  });

  test("routes interactive DuckDB workspace manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "table"],
      checkboxQueue: [["users", "analytics.events"]],
      requiredPathQueue: ["fixtures/query.duckdb"],
      inputQueue: [
        "users",
        "events",
        "select users.id, events.event_type from users join events on users.id = events.user_id order by events.id",
        "10",
      ],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          relations: [
            { alias: "users", source: "users" },
            { alias: "events", source: "analytics.events" },
          ],
          rows: 10,
          sql: "select users.id, events.event_type from users join events on users.id = events.user_id order by events.id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "checkbox:Choose DuckDB relations for the workspace",
    );
    expect(result.stderr).toContain("Workspace relations: users, events");
  });

  test("routes interactive DuckDB single-source manual mode through shared query execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "single-source", "analytics.events", "manual", "table"],
      nowIsoString: "2026-03-30T00:00:00.300Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.duckdb"],
      inputQueue: ["select id, event_type from file order by id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "user_id", type: "INTEGER" },
          { name: "event_type", type: "VARCHAR" },
        ],
        sampleRows: [{ event_type: "login", id: "10", user_id: "1" }],
        selectedSource: "analytics.events",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          source: "analytics.events",
          sql: "select id, event_type from file order by id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose a DuckDB source",
    );
  });

  test("accepts explicit file workspace aliases without re-prompting", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "table"],
      checkboxQueue: [["file"]],
      requiredPathQueue: ["fixtures/query.duckdb"],
      inputQueue: ["file", "select user_id from file order by user_id", "10"],
      confirmQueue: [true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
    });

    expect(
      result.validationCalls.some(
        (call) =>
          call.kind === "input" &&
          call.message === "Relation name for file" &&
          call.value === "file",
      ),
    ).toBe(false);
    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          json: undefined,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          relations: [{ alias: "file", source: "file" }],
          rows: 10,
          sql: "select user_id from file order by user_id",
        },
      },
    ]);
  });

  test("re-prompts invalid and duplicate workspace aliases before continuing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "manual", "cancel"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      inputQueue: [
        "1users",
        "users",
        "users",
        "active",
        "select users.id from users order by users.id",
      ],
      confirmQueue: [true, false],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
    });

    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Relation name for users",
      value: "1users",
      error:
        "Use a simple SQL identifier (letters, numbers, underscore; cannot start with a number).",
    });
    expect(result.validationCalls).toContainEqual({
      kind: "input",
      message: "Relation name for active_users",
      value: "users",
      error: "Relation name already used: users.",
    });
    expect(result.actionCalls).toEqual([]);
  });

  test("supports checkpoint change-mode from manual sql review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "manual",
        "change-mode",
        "formal-guide",
        "count",
        "table",
      ],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file", "all", "", "", "", "5"],
      confirmQueue: [true, false, false, false, true],
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
          sql: "select count(*) as row_count\nfrom file",
        },
      },
    ]);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Choose mode"),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
    expect(result.stderr).toContain("Table preview rows:");
    expect(result.stderr).toContain("5");
  });

  test("writes the tty abort notice for interactive data query startup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "cancel"],
      nowIsoString: "2026-03-30T00:00:00.000Z",
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, false, false],
      dataQueryDetectedFormat: "csv",
      stdoutColumns: 20,
      stdoutIsTTY: true,
    });

    expect(result.actionCalls).toEqual([]);
    expect(stripAnsi(result.stderr)).toContain("Tip: Ctrl+C to abort.");
    expect(stripAnsi(result.stderr).match(/Tip:/g) ?? []).toHaveLength(1);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("supports cancel from sql review without executing the query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, false, false],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("returns to the current sql review from output selection without reopening sql entry", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "back", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file", "10"],
      confirmQueue: [true, false, true, true],
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
          rows: 10,
          source: undefined,
          sql: "select id from file",
        },
      },
    ]);
    expect(
      result.promptCalls.filter((call) => call.kind === "input" && call.message === "SQL query"),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Execute this SQL?",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Output mode"),
    ).toHaveLength(2);
  });

  test("routes interactive data extract through shared extraction execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false, true, true],
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
    const plainStderr = stripAnsi(result.stderr);

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
    expect(plainStderr).toContain("Tip: Change destination keeps the current extraction setup.");
    expect(plainStderr.match(/Tip:/g) ?? []).toHaveLength(1);
    expect(
      plainStderr
        .trimStart()
        .startsWith("Tip: Change destination keeps the current extraction setup."),
    ).toBe(true);
    expect(
      plainStderr.indexOf("Tip: Change destination keeps the current extraction setup."),
    ).toBeLessThan(plainStderr.indexOf("Input:"));
    expect(plainStderr).toContain("Extraction write summary");
    expect(plainStderr).toContain("Extraction review");
    expect(plainStderr).toContain("- output format: JSON");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Continue to output setup?",
    );
  });

  test("routes interactive data stack through shared stack execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "continue", "write"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 3,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher("20260330T000000Z", "json"),
          overwrite: false,
          rowCount: 6,
        },
      },
    ]);
    expect(result.pathCalls).toContainEqual({
      kind: "required",
      message: "Input source",
      options: expect.objectContaining({
        kind: "path",
      }),
    });
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output JSON file",
      options: expect.objectContaining({
        kind: "file",
        defaultHint: dataStackDefaultOutputMatcher("20260330T000000Z", "json"),
      }),
    });
    expect(result.pathCalls.some((call) => call.kind === "hint")).toBe(false);
    expect(plainStderr).toContain("Tip: Review matched files before writing the stacked output.");
    expect(plainStderr).toContain("Stack review");
    expect(plainStderr).toContain("- input sources: 1");
    expect(plainStderr).toContain("- input format: CSV");
    expect(plainStderr).toContain("- pattern: *.csv");
    expect(plainStderr).toContain("- traversal: shallow only");
    expect(plainStderr).toContain("- schema mode: strict");
    expect(plainStderr).toContain("- output format: JSON");
    expect(plainStderr).toMatch(/- output: data-stack-20260330T000000Z-[a-f0-9]{8}\.json/);
    expect(plainStderr).toContain("- matched files: 3");
    expect(plainStderr).toContain("Codex assist checkpoint");
    expect(plainStderr).toContain("- signals: candidate unique keys");
    expect(result.codexReportWrites).toHaveLength(0);
    expect(
      result.selectChoicesByMessage["Codex assist checkpoint"]?.map((choice) => choice.value),
    ).toEqual(["codex", "continue", "review", "cancel"]);
    expect(result.selectChoicesByMessage["Schema mode"]?.map((choice) => choice.value)).toEqual([
      "auto",
      "strict",
      "union-by-name",
    ]);
    expect(result.selectChoicesByMessage["Stack action"]?.map((choice) => choice.value)).toEqual([
      "write",
      "dry-run",
      "review",
      "destination",
      "cancel",
    ]);
  });

  test("skips the interactive data stack Codex checkpoint when diagnostics have no useful signals", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-no-codex-signal"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 2,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: false,
          rowCount: 8,
        },
      },
    ]);
    expect(result.codexReportWrites).toHaveLength(0);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "select:Codex assist checkpoint",
    );
  });

  test("interactive data stack can analyze schema mode automatically", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "auto", "json", "continue", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-header-mismatch"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 2,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: false,
          rowCount: 4,
        },
      },
    ]);
    expect(plainStderr).toContain("- schema mode: union-by-name");
    expect(plainStderr).toContain("- schema analysis: auto -> union-by-name");
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      schemaMode: "union-by-name",
    });
  });

  test("bounds interactive data stack input-source and matched-file samples", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "continue", "cancel"],
      requiredPathQueue: [
        "examples/playground/stack-cases/csv-many-files/part-001.csv",
        "examples/playground/stack-cases/csv-many-files/part-002.csv",
        "examples/playground/stack-cases/csv-many-files/part-003.csv",
        "examples/playground/stack-cases/csv-many-files/part-004.csv",
        "examples/playground/stack-cases/csv-many-files/part-005.csv",
        "examples/playground/stack-cases/csv-many-files/part-006.csv",
      ],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [true, true, true, true, true, false, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(plainStderr).toContain("- input sources: 6");
    expect(plainStderr).toContain("1. examples/playground/stack-cases/csv-many-files/part-001.csv");
    expect(plainStderr).toContain("5. examples/playground/stack-cases/csv-many-files/part-005.csv");
    expect(plainStderr).not.toContain(
      "6. examples/playground/stack-cases/csv-many-files/part-006.csv",
    );
    expect(plainStderr).toContain("... 1 more input source(s) hidden");
    expect(plainStderr).toContain("- matched files: 6");
    expect(plainStderr).toContain("- sample files (first 5):");
    expect(plainStderr).toContain("csv-many-files/part-001.csv");
    expect(plainStderr).toContain("csv-many-files/part-005.csv");
    expect(plainStderr).not.toContain("csv-many-files/part-006.csv");
    expect(plainStderr).toContain("- sample files hidden: 1");
  });

  test("routes interactive data stack with mixed file and directory sources", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "continue", "write"],
      requiredPathQueue: [
        "examples/playground/stack-cases/csv-matching-headers/part-001.csv",
        "examples/playground/stack-cases/csv-matching-headers",
      ],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [true, false, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 3,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: false,
          rowCount: 6,
        },
      },
    ]);
    expect(result.pathCalls).toContainEqual({
      kind: "required",
      message: "Additional input source",
      options: expect.objectContaining({
        kind: "path",
      }),
    });
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output JSON file",
      options: expect.objectContaining({
        kind: "file",
        defaultHint: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
      }),
    });
    expect(result.pathCalls.some((call) => call.kind === "hint")).toBe(false);
    expect(plainStderr).toContain("- input sources: 2");
    expect(plainStderr).toContain("- matched files: 3");
  });

  test("routes interactive data stack with JSON input selection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "json", "shallow", "strict", "csv", "continue", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/json-array-basic"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.json"],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 2,
          outputFormat: "csv",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "csv"),
          overwrite: false,
          rowCount: 3,
        },
      },
    ]);
    expect(plainStderr).toContain("- input format: JSON");
    expect(plainStderr).toContain("- schema mode: strict");
  });

  test("routes interactive data stack with JSONL input selection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "jsonl",
        "shallow",
        "strict",
        "json",
        "continue",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/jsonl-basic"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.jsonl"],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 2,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: false,
          rowCount: 4,
        },
      },
    ]);
    expect(plainStderr).toContain("- input format: JSONL");
    expect(plainStderr).toContain("- schema mode: strict");
  });

  test("routes interactive data stack with union-by-name exclusions", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "union-by-name",
        "json",
        "continue",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-union"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv", "noise"],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 2,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: false,
          rowCount: 2,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Exclude columns or keys (optional, comma-separated)",
    );
    expect(plainStderr).toContain("- schema mode: union-by-name");
    expect(plainStderr).toContain("- excluded columns: 1 (noise)");
  });

  test("lets interactive data stack stop before writing at the final review checkpoint", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "csv", "continue", "cancel"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, false],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stderr).toContain("Stack review");
    expect(result.stderr).toContain("Skipped stack write.");
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output CSV file",
      options: expect.objectContaining({
        customMessage: "Custom CSV output path",
        defaultHint: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "csv"),
      }),
    });
    expect(result.pathCalls.some((call) => call.kind === "hint")).toBe(false);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Stack action",
    );
  });

  test("writes an interactive data stack dry-run plan without materialized output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "continue",
        "dry-run",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined, undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stackPlanWrites).toHaveLength(1);
    expect(result.stackPlanWrites[0]?.path).toEqual(
      expect.stringMatching(/data-stack-plan-20260225T000000Z-[a-f0-9]{8}\.json$/),
    );
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      fileCount: 3,
      outputFormat: "json",
      rowCount: 6,
    });
    expect(result.stderr).toContain("Dry run: wrote stack plan");
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Stack plan JSON file",
      options: expect.objectContaining({
        customMessage: "Custom stack plan JSON path",
        defaultHint: expect.stringMatching(/^data-stack-plan-20260225T000000Z-[a-f0-9]{8}\.json$/),
      }),
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Keep stack plan?",
    );
  });

  test("reviews and accepts interactive data stack Codex recommendations before writing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "codex",
        "accept",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.91,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "The id column has unique values in the sampled rows.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.codexReportWrites).toEqual([
      {
        path: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
        options: { recommendationCount: 1 },
      },
    ]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: ["rec_unique_id"],
      derivedFromPayloadId: "stack-payload-test",
      recommendationDecisions: [
        expect.objectContaining({
          decision: "accepted",
          recommendationId: "rec_unique_id",
        }),
      ],
      uniqueBy: ["id"],
    });
    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: expect.objectContaining({
          uniqueBy: ["id"],
        }),
      },
    ]);
    expect(stripAnsi(result.stderr)).toContain("Accepted Codex changes");
    expect(stripAnsi(result.stderr)).toContain("Re-running stack status preview");
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Stack action",
      ),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Codex assist checkpoint",
      ),
    ).toHaveLength(1);
  });

  test("reviews edited interactive data stack Codex patches before writing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "codex",
        "edit",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      editorQueue: [
        JSON.stringify([{ op: "replace", path: "/duplicates/policy", value: "report" }], null, 2),
      ],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.8,
          id: "rec_duplicate_policy",
          patches: [{ op: "replace", path: "/duplicates/policy", value: "reject" }],
          reasoningSummary: "Duplicate policy should be explicit.",
          title: "Set duplicate policy",
        },
      ],
    });

    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      duplicatePolicy: "report",
      recommendationDecisions: [
        expect.objectContaining({
          decision: "edited",
          recommendationId: "rec_duplicate_policy",
        }),
      ],
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "editor:Edit recommendation patches JSON",
    );
  });

  test("saves an accepted interactive Codex recommendation in dry-run-only mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "codex",
        "accept",
        "dry-run",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined, undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, false, false],
      dataStackCodexRecommendations: [
        {
          confidence: 0.91,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "The id column has unique values in the sampled rows.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.codexReportWrites).toEqual([
      {
        path: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
        options: { recommendationCount: 1 },
      },
    ]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: ["rec_unique_id"],
      reportPath: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
      uniqueBy: ["id"],
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Keep diagnostic/advisory report?",
    );
    expect(result.removedPaths).toContainEqual(
      expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
    );
    expect(result.stderr).toContain("Dry run: wrote stack plan");
  });

  test("can remove the interactive Codex advisory report separately", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "codex",
        "skip",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, false],
      dataStackCodexRecommendations: [
        {
          confidence: 0.7,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "Potential unique key.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: [],
      reportPath: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
      uniqueBy: [],
    });
    expect(result.removedPaths).toContainEqual(
      expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
    );
    expect(stripAnsi(result.stderr)).toContain("Removed diagnostic/advisory report:");
  });

  test("keeps deterministic setup when interactive Codex review is cancelled", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "codex",
        "cancel",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.7,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "Potential unique key.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: expect.not.objectContaining({
          uniqueBy: ["id"],
        }),
      },
    ]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: [],
      uniqueBy: [],
    });
    expect(stripAnsi(result.stderr)).toContain("No Codex recommendations accepted.");
  });

  test("keeps deterministic setup when interactive Codex recommendation application fails", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "codex",
        "accept",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.7,
          id: "rec_unknown_key",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["missing"] }],
          reasoningSummary: "Invalid key in test.",
          title: "Use missing as the unique key",
        },
      ],
    });

    expect(result.actionCalls).toHaveLength(1);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: [],
      uniqueBy: [],
    });
    expect(stripAnsi(result.stderr)).toContain("Codex recommendation application failed:");
    expect(stripAnsi(result.stderr)).toContain("Keeping current deterministic stack setup.");
  });

  test("keeps interactive data stack setup when Codex recommendations fail", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "codex", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true],
      dataStackCodexErrorMessage:
        '{"type":"error","error":{"type":"invalid_request_error","code":"invalid_json_schema","message":"Invalid schema for response_format"}}',
      stdoutIsTTY: true,
    });

    expect(result.codexReportWrites).toHaveLength(0);
    expect(result.actionCalls).toHaveLength(1);
    expect(result.stdout.endsWith("\r\u001b[2K")).toBe(true);
    expect(stripAnsi(result.stderr)).toContain(
      "Codex stack recommendations unavailable: Codex rejected the structured recommendation schema.",
    );
    expect(stripAnsi(result.stderr)).not.toContain("invalid_json_schema");
    expect(stripAnsi(result.stderr)).not.toContain("invalid_request_error");
    expect(stripAnsi(result.stderr)).not.toContain("response_format");
    expect(stripAnsi(result.stderr)).toContain("Keeping current deterministic stack setup.");
  });

  test("keeps interactive data stack setup when Codex recommendations fail with plain text", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "codex", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true],
      dataStackCodexErrorMessage: "mocked Codex outage",
      stdoutIsTTY: true,
    });

    expect(result.codexReportWrites).toHaveLength(0);
    expect(result.actionCalls).toHaveLength(1);
    expect(result.stdout.endsWith("\r\u001b[2K")).toBe(true);
    expect(stripAnsi(result.stderr)).toContain(
      "Codex stack recommendations unavailable. Review failed before recommendations were returned.",
    );
    expect(stripAnsi(result.stderr)).not.toContain("mocked Codex outage");
    expect(stripAnsi(result.stderr)).toContain("Keeping current deterministic stack setup.");
  });

  test("removes the interactive stack plan when write succeeds and keeping is declined", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "continue", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, false],
    });

    expect(result.actionCalls.map((call) => call.name)).toEqual(["data:stack"]);
    expect(result.stackPlanWrites).toHaveLength(1);
    expect(result.stackPlanWrites[0]?.path).toEqual(
      expect.stringMatching(/data-stack-plan-20260225T000000Z-[a-f0-9]{8}\.json$/),
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Keep stack plan?",
    );
    expect(result.stderr).toContain("Removed stack plan:");
  });

  test("keeps the interactive stack plan when materialized writing fails", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: [
          "data",
          "data:stack",
          "csv",
          "shallow",
          "strict",
          "json",
          "continue",
          "write",
        ],
        requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
        optionalPathQueue: [undefined],
        inputQueue: ["*.csv"],
        confirmQueue: [false],
        dataStackActionErrorMessage: "write failed",
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("write failed");
    expect(result.stackPlanWrites).toHaveLength(1);
    expect(result.stderr).toContain("Keeping stack plan after failed write:");
    expect(result.stderr).not.toContain("Removed stack plan:");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "confirm:Keep stack plan?",
    );
  });

  test("uses the expected TSV default output metadata in interactive data stack", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "tsv", "continue", "cancel"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, false],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output TSV file",
      options: expect.objectContaining({
        customMessage: "Custom TSV output path",
        defaultHint: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "tsv"),
      }),
    });
    expect(result.pathCalls.some((call) => call.kind === "hint")).toBe(false);
    expect(result.stderr).toContain("Skipped stack write.");
  });

  test("lets interactive data stack change destination without re-running stack setup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "continue",
        "destination",
        "json",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined, "fixtures/custom-stacked.json"],
      inputQueue: ["*.csv"],
      confirmQueue: [false, false, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 3,
          outputFormat: "json",
          outputPath: expect.stringContaining("fixtures/custom-stacked.json"),
          overwrite: false,
          rowCount: 6,
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "input" && call.message === "Filename pattern",
      ),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Output format",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Stack action",
    );
    expect(stripAnsi(result.stderr)).toContain("- output: fixtures/custom-stacked.json");
  });

  test("re-enters the full stack setup when stack write chooses revise setup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "shallow",
        "strict",
        "json",
        "continue",
        "review",
        "csv",
        "recursive",
        "strict",
        "json",
        "continue",
        "write",
      ],
      requiredPathQueue: [
        "examples/playground/stack-cases/csv-matching-headers",
        "examples/playground/stack-cases/csv-matching-headers",
      ],
      optionalPathQueue: [undefined, undefined],
      inputQueue: ["*.csv", "*.csv"],
      confirmQueue: [false, false, false, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 3,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: false,
          rowCount: 6,
        },
      },
    ]);
    expect(
      result.pathCalls.filter(
        (call) => call.kind === "required" && call.message === "Input source",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "input" && call.message === "Filename pattern",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Traversal mode",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Stack action",
    );
  });

  test("re-prompts stack destination when the generated default output exists and overwrite is declined", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "continue", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined, "fixtures/custom-stacked.json"],
      inputQueue: ["*.csv"],
      confirmQueue: [false, false, true],
      statExistsQueue: [true, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 3,
          outputFormat: "json",
          outputPath: expect.stringContaining("fixtures/custom-stacked.json"),
          overwrite: false,
          rowCount: 6,
        },
      },
    ]);
    expect(
      result.pathCalls.filter(
        (call) => call.kind === "optional" && call.message === "Output JSON file",
      ),
    ).toHaveLength(2);
    const defaultHints = result.pathCalls
      .filter((call) => call.kind === "optional" && call.message === "Output JSON file")
      .map((call) => call.options?.defaultHint);
    expect(defaultHints).toHaveLength(2);
    for (const defaultHint of defaultHints) {
      expect(typeof defaultHint).toBe("string");
      expect(
        dataStackDefaultPathPattern(DEFAULT_DATA_STACK_TIMESTAMP, "json").test(
          defaultHint as string,
        ),
      ).toBe(true);
    }
    expect(new Set(defaultHints).size).toBe(2);
    expect(
      result.pathCalls.filter(
        (call) =>
          call.kind === "optional" &&
          call.message === "Output JSON file" &&
          call.options?.customMessage === "Custom JSON output path",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Overwrite if exists?",
    );
    expect(result.stdout).toContain("Choose a different output destination.");
  });

  test("accepts overwrite for the generated default stack output path when confirmed", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "shallow", "strict", "json", "continue", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      statExistsQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: {
          fileCount: 3,
          outputFormat: "json",
          outputPath: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
          overwrite: true,
          rowCount: 6,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Overwrite if exists?",
    );
    expect(result.pathCalls).toContainEqual({
      kind: "optional",
      message: "Output JSON file",
      options: expect.objectContaining({
        customMessage: "Custom JSON output path",
        defaultHint: dataStackDefaultOutputMatcher(DEFAULT_DATA_STACK_TIMESTAMP, "json"),
      }),
    });
  });

  test("routes interactive DuckDB data extract through shared extraction execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "users", "json"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.duckdb"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "name", type: "VARCHAR" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada", status: "active" }],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          output: "fixtures/query.json",
          overwrite: false,
          source: "users",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Choose a DuckDB source",
    );
    expect(stripAnsi(result.stderr)).toContain("Extraction review");
    expect(stripAnsi(result.stderr)).toContain("- source: users");
  });

  test("lets interactive data extract stop before materialization at the final write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "csv", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, false, true, false],
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

  test("lets interactive DuckDB data extract stop before materialization at the final write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "users", "json", "cancel"],
      requiredPathQueue: ["fixtures/query.duckdb"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, false],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "name", type: "VARCHAR" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada", status: "active" }],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stderr).toContain("Extraction write summary");
    expect(result.stderr).toContain("Skipped extraction write.");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Extraction write next step",
    );
  });

  test("supports checkpoint backtracking from the extraction write boundary", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json", "review", "revise", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, false, true, false, false, true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospectionQueue: [
        {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
          ],
          sampleRows: [{ id: "1", name: "Ada" }],
          truncated: false,
        },
        {
          columns: [
            { name: "column_1", type: "VARCHAR" },
            { name: "column_2", type: "VARCHAR" },
          ],
          sampleRows: [{ column_1: "id", column_2: "name" }],
          truncated: false,
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          noHeader: true,
          output: "fixtures/query.json",
          overwrite: false,
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Treat CSV/TSV input as headerless?",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Extraction write next step",
    );
    expect(
      result.selectChoicesByMessage["Extraction write next step"]?.map((choice) => choice.value),
    ).toEqual(["review", "destination", "cancel"]);
  });

  test("re-selects the source after revising extraction setup in a multi-source flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:extract",
        "Summary",
        "json",
        "review",
        "revise",
        "Summary",
        "json",
      ],
      nowIsoString: "2026-03-30T00:00:00.400Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.xlsx"],
      inputQueue: ["", ""],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, true, false, false, true, true],
      dataQueryDetectedFormat: "excel",
      dataQuerySources: ["Summary", "Archive"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.xlsx",
          inputFormat: "excel",
          output: "fixtures/query.json",
          overwrite: false,
          source: "Summary",
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Choose an Excel sheet",
      ),
    ).toHaveLength(2);
    expect(stripAnsi(result.stderr).match(/Tip:/g) ?? []).toHaveLength(1);
    expect(stripAnsi(result.stderr).indexOf("Tip:")).toBeLessThan(
      stripAnsi(result.stderr).indexOf("Input:"),
    );
  });

  test("re-selects the DuckDB source after revising extraction setup in a multi-source flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "users", "json", "review", "revise", "users", "json"],
      nowIsoString: "2026-03-30T00:00:00.400Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.duckdb"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, true, false, false, true, true],
      dataQueryDetectedFormat: "duckdb",
      dataQuerySources: ["users", "time_entries", "file", "analytics.events"],
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "name", type: "VARCHAR" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada", status: "active" }],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.duckdb",
          inputFormat: "duckdb",
          output: "fixtures/query.json",
          overwrite: false,
          source: "users",
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Choose a DuckDB source",
      ),
    ).toHaveLength(2);
  });

  test("reopens destination selection without re-running extraction setup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "csv", "destination", "json"],
      nowIsoString: "2026-03-30T00:00:00.900Z",
      stdoutColumns: 80,
      stdoutIsTTY: true,
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [true, false, true, false, true],
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
    const plainStderr = stripAnsi(result.stderr);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Treat CSV/TSV input as headerless?",
      ),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Output format",
      ),
    ).toHaveLength(2);
    expect(plainStderr).toContain("Tip: Change destination keeps the current extraction setup.");
    expect(plainStderr.match(/Tip:/g) ?? []).toHaveLength(1);
    expect(
      plainStderr
        .trimStart()
        .startsWith("Tip: Change destination keeps the current extraction setup."),
    ).toBe(true);
    expect(
      plainStderr.indexOf("Tip: Change destination keeps the current extraction setup."),
    ).toBeLessThan(plainStderr.indexOf("Input:"));
  });

  test("writes the tty abort notice for interactive data extract startup", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "cancel"],
      nowIsoString: "2026-03-30T00:00:00.000Z",
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, false],
      dataQueryDetectedFormat: "csv",
      stdoutColumns: 20,
      stdoutIsTTY: true,
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
    expect(stripAnsi(result.stderr)).toContain("Tip: Ctrl+C to abort.");
    expect(stripAnsi(result.stderr).match(/Tip:/g) ?? []).toHaveLength(1);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Extraction review next step",
    );
  });

  test("routes interactive data extract in explicit headerless mode for CSV input", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:extract", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      optionalPathQueue: [undefined],
      confirmQueue: [true, true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "column_1", type: "VARCHAR" },
          { name: "column_2", type: "VARCHAR" },
        ],
        sampleRows: [{ column_1: "id", column_2: "name" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:extract",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          noHeader: true,
          output: "fixtures/query.json",
          overwrite: false,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Treat CSV/TSV input as headerless?",
    );
    expect(result.stderr).toContain("header mode: treat CSV/TSV input as headerless");
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
      inputQueue: ["all", "status", "status:asc", "", "5"],
      confirmQueue: [true, false, false, true],
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

  test("routes interactive data query manual mode in explicit headerless CSV mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select column_1, column_2 from file order by column_1", "10"],
      confirmQueue: [true, true, false, true, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "column_1", type: "VARCHAR" },
          { name: "column_2", type: "VARCHAR" },
        ],
        sampleRows: [{ column_1: "id", column_2: "name" }],
        truncated: false,
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query",
        options: {
          input: "fixtures/query.csv",
          inputFormat: "csv",
          json: undefined,
          noHeader: true,
          output: undefined,
          overwrite: undefined,
          pretty: undefined,
          rows: 10,
          sql: "select column_1, column_2 from file order by column_1",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Treat CSV/TSV input as headerless?",
    );
  });

  test("rejects aggregate formal-guide order-by columns outside the result set", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "count", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "status:asc", "row_count:desc", "", "5"],
      confirmQueue: [true, false, false, true],
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

  test("routes formal-guide filter operators and optional SQL limit without prompting for value-less filters", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "formal-guide",
        "name",
        "starts-with",
        "deleted_at",
        "is-null",
        "none",
        "table",
      ],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "Ad", "", "25", "10"],
      confirmQueue: [true, false, true, true, false, true],
      dataQueryDetectedFormat: "csv",
      dataQueryIntrospection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
          { name: "deleted_at", type: "TIMESTAMP" },
        ],
        sampleRows: [{ id: "1", name: "Ada", deleted_at: "" }],
        truncated: false,
      },
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
          rows: 10,
          source: undefined,
          sql: `select *
from file
where lower(cast("name" as varchar)) like lower('Ad') || '%' and "deleted_at" is null
limit 25`,
        },
      },
    ]);
    expect(
      result.promptCalls.filter((call) => call.kind === "input" && call.message === "Filter value"),
    ).toHaveLength(1);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "input:Maximum result rows (optional)",
    );
  });

  test("supports checkpoint backtracking from output selection to sql review in formal-guide", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "none", "back", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "25", ""],
      confirmQueue: [true, false, false, true, true],
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
          rows: undefined,
          source: undefined,
          sql: "select *\nfrom file\nlimit 25",
        },
      },
    ]);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "confirm" && call.message === "Execute this SQL?",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Output mode"),
    ).toHaveLength(2);
    expect(result.stderr).toContain("SQL limit:");
    expect(result.stderr).toContain("Table preview rows:");
    expect(result.stderr).toContain("default bounded");
  });

  test("supports cancel from output selection without executing the query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "formal-guide", "none", "cancel"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["all", "", "", ""],
      confirmQueue: [true, false, false, true],
      dataQueryDetectedFormat: "csv",
    });

    expect(result.actionCalls).toEqual([]);
    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Output mode"),
    ).toHaveLength(1);
  });

  test("routes Codex Assistant through the default single-line intent prompt", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, false, true, false],
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

  test("routes Codex Assistant through workspace drafting in interactive query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "json"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, true, false],
      inputQueue: ["users", "active", "join users with active users"],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
      dataQueryWorkspaceIntrospection: {
        relations: [
          {
            alias: "users",
            columns: [
              { name: "id", type: "BIGINT" },
              { name: "name", type: "VARCHAR" },
            ],
            sampleRows: [{ id: "1", name: "Ada" }],
            source: "users",
            truncated: false,
          },
          {
            alias: "active",
            columns: [
              { name: "id", type: "BIGINT" },
              { name: "is_active", type: "BOOLEAN" },
            ],
            sampleRows: [{ id: "1", is_active: "true" }],
            source: "active_users",
            truncated: false,
          },
        ],
      },
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:query:codex-draft",
        options: {
          format: "sqlite",
          intent: "join users with active users",
          relations: [
            {
              alias: "users",
              columns: [
                { name: "id", type: "BIGINT" },
                { name: "name", type: "VARCHAR" },
              ],
              sampleRows: [{ id: "1", name: "Ada" }],
              source: "users",
              truncated: false,
            },
            {
              alias: "active",
              columns: [
                { name: "id", type: "BIGINT" },
                { name: "is_active", type: "BOOLEAN" },
              ],
              sampleRows: [{ id: "1", is_active: "true" }],
              source: "active_users",
              truncated: false,
            },
          ],
        },
      },
      {
        name: "data:query",
        options: {
          input: "fixtures/query.sqlite",
          inputFormat: "sqlite",
          json: true,
          output: undefined,
          overwrite: undefined,
          pretty: false,
          relations: [
            { alias: "users", source: "users" },
            { alias: "active", source: "active_users" },
          ],
          rows: undefined,
          sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "select:Choose a SQLite source",
    );
  });

  test("supports workspace change-mode from manual review into Codex Assistant", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "workspace",
        "manual",
        "change-mode",
        "Codex Assistant",
        "json",
      ],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, true, false],
      inputQueue: [
        "users",
        "active",
        "select users.id from users order by users.id",
        "join users with active users",
      ],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Choose mode"),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter(
        (call) =>
          call.kind === "checkbox" && call.message === "Choose SQLite relations for the workspace",
      ),
    ).toHaveLength(1);
    expect(result.actionCalls).toContainEqual({
      name: "data:query:codex-draft",
      options: {
        format: "sqlite",
        intent: "join users with active users",
        relations: [
          expect.objectContaining({ alias: "users", source: "users" }),
          expect.objectContaining({ alias: "active", source: "active_users" }),
        ],
      },
    });
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        input: "fixtures/query.sqlite",
        inputFormat: "sqlite",
        json: true,
        output: undefined,
        overwrite: undefined,
        pretty: false,
        relations: [
          { alias: "users", source: "users" },
          { alias: "active", source: "active_users" },
        ],
        rows: undefined,
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
      },
    });
  });

  test("supports workspace regenerate from codex sql review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "regenerate", "table"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, true],
      inputQueue: ["users", "active", "join users with active users", "10"],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        input: "fixtures/query.sqlite",
        inputFormat: "sqlite",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        relations: [
          { alias: "users", source: "users" },
          { alias: "active", source: "active_users" },
        ],
        rows: 10,
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
      },
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("supports workspace change-mode from codex review back to manual mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:query",
        "workspace",
        "Codex Assistant",
        "change-mode",
        "manual",
        "table",
      ],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, true],
      inputQueue: [
        "users",
        "active",
        "join users with active users",
        "select users.id, active.name from users join active on users.id = active.id order by users.id",
        "10",
      ],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.promptCalls.filter((call) => call.kind === "select" && call.message === "Choose mode"),
    ).toHaveLength(2);
    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(1);
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        input: "fixtures/query.sqlite",
        inputFormat: "sqlite",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        relations: [
          { alias: "users", source: "users" },
          { alias: "active", source: "active_users" },
        ],
        rows: 10,
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
      },
    });
  });

  test("supports workspace cancel from codex sql review without executing the query", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "cancel"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false],
      inputQueue: ["users", "active", "join users with active users"],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(1);
    expect(result.actionCalls.filter((call) => call.name === "data:query")).toHaveLength(0);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
  });

  test("reopens workspace codex intent entry when sql review chooses revise", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "workspace", "Codex Assistant", "revise", "table"],
      checkboxQueue: [["users", "active_users"]],
      requiredPathQueue: ["fixtures/query.sqlite"],
      confirmQueue: [true, false, false, false, true],
      inputQueue: [
        "users",
        "active",
        "join users with active users",
        "join active users by id",
        "10",
      ],
      dataQueryDetectedFormat: "sqlite",
      dataQuerySources: ["users", "active_users"],
      dataQueryCodexDraft: {
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
        reasoningSummary: "Joins the two workspace relations on id.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "input" && call.message === "Describe the query intent:",
      ),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        input: "fixtures/query.sqlite",
        inputFormat: "sqlite",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        relations: [
          { alias: "users", source: "users" },
          { alias: "active", source: "active_users" },
        ],
        rows: 10,
        sql: "select users.id, active.name from users join active on users.id = active.id order by users.id",
      },
    });
  });

  test("supports checkpoint regenerate from codex sql review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "regenerate", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, false, false, true],
      editorQueue: ["unused editor content"],
      inputQueue: ["count rows by status", "10"],
      dataQueryDetectedFormat: "csv",
      dataQueryCodexDraft: {
        sql: 'select "status", count(*) as row_count from file group by "status"',
        reasoningSummary: "Counts rows by status.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        input: "fixtures/query.csv",
        inputFormat: "csv",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        rows: 10,
        source: undefined,
        sql: 'select "status", count(*) as row_count from file group by "status"',
      },
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:SQL review next step",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "editor:Describe the query intent:",
    );
  });

  test("reopens codex intent entry directly when sql review chooses revise", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "revise", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, false, false, false, true],
      inputQueue: ["count rows by status", "count rows by status", "10"],
      dataQueryDetectedFormat: "csv",
      dataQueryCodexDraft: {
        sql: 'select "status", count(*) as row_count from file group by "status"',
        reasoningSummary: "Counts rows by status.",
      },
    });

    expect(
      result.actionCalls.filter((call) => call.name === "data:query:codex-draft"),
    ).toHaveLength(2);
    expect(result.actionCalls).toContainEqual({
      name: "data:query",
      options: {
        input: "fixtures/query.csv",
        inputFormat: "csv",
        json: undefined,
        output: undefined,
        overwrite: undefined,
        pretty: undefined,
        rows: 10,
        source: undefined,
        sql: 'select "status", count(*) as row_count from file group by "status"',
      },
    });
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "input" && call.message === "Describe the query intent:",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "select:Codex Assistant next step",
    );
  });

  test("keeps interactive query metadata off stdout for json output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "manual", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["select id from file"],
      confirmQueue: [true, false, true, false],
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
          "Excel query requires the DuckDB excel extension, and it is not installed in the current environment. Install it explicitly in DuckDB, then retry.",
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
    expect(result.stderr).toContain(
      "Sheet shape warning: current Excel sheet shape looks suspicious.",
    );
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
      confirmQueue: [true, true, false],
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
      confirmQueue: [true, true, false],
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
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Choose how to continue",
      ),
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
      confirmQueue: [true, false, true, true],
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
    expect(result.stderr).toContain(
      "Accepted header mappings. Re-inspecting shaped source before SQL authoring.",
    );
  });

  test("supports editing one interactive header suggestion before acceptance", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "edit", "column_2", "accept", "manual", "table"],
      requiredPathQueue: ["fixtures/query.csv"],
      inputQueue: ["state", "select id, state from file order by id", "10"],
      confirmQueue: [true, false, true, true],
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
      confirmQueue: [true, false, true, true],
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
      confirmQueue: [true, false, true, true, true, false],
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
    expect(editorPrompt?.defaultValue).toContain(
      "# Write plain intent below. Comment lines starting with # are ignored.",
    );
    expect(result.stderr).toContain("Intent: count rows by status");
  });

  test("keeps Codex intent preview off stdout before json output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, true, true, true, false],
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
    expect(result.stderr).toContain(
      'select "status", count(*) as row_count from file group by "status"',
    );
  });

  test("reopens the multiline editor until the cleaned intent is confirmed", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:query", "Codex Assistant", "json"],
      requiredPathQueue: ["fixtures/query.csv"],
      confirmQueue: [true, false, true, false, true, true, true, false],
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
      result.promptCalls.filter(
        (call) => call.kind === "editor" && call.message === "Describe the query intent:",
      ),
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
      confirmQueue: [true, false, true, false, false],
      existingPaths: ["reports/existing.json"],
      dataQueryDetectedFormat: "csv",
    });

    expect(
      result.pathCalls.filter(
        (call) => call.kind === "required" && call.message === "Output file path",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Overwrite if exists?",
    );
    expect(result.stdout).toContain("Choose a different output destination.");
    expect(result.actionCalls).toHaveLength(1);
    expect(result.actionCalls[0]).toMatchObject({
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

  test("does not show the abort tip for the lightweight preview flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:preview"],
      nowIsoString: "2026-03-30T00:00:00.000Z",
      requiredPathQueue: ["fixtures/table.csv"],
      confirmQueue: [false],
      inputQueue: ["", "", "", ""],
      stdoutColumns: 30,
      stdoutIsTTY: true,
    });

    const plainStderr = stripAnsi(result.stderr);
    expect(result.actionCalls).toEqual([
      {
        name: "data:preview",
        options: {
          input: "fixtures/table.csv",
          rows: undefined,
          offset: undefined,
          columns: undefined,
          contains: undefined,
        },
      },
    ]);
    expect(plainStderr).not.toContain("Tip:");
  });

  test("does not show the abort tip for lightweight preview input errors", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["data", "data:preview"],
        nowIsoString: "2026-03-30T00:00:00.000Z",
        requiredPathQueue: ["fixtures/table.txt"],
        stdoutColumns: 80,
        stdoutIsTTY: true,
      },
      { allowFailure: true },
    );

    const plainStderr = stripAnsi(result.stderr);
    expect(result.error).toContain("Unsupported lightweight data file type: .txt");
    expect(plainStderr).not.toContain("Tip:");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "confirm:Treat CSV/TSV input as headerless?",
    );
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
      error: "Invalid --contains value \"status\": missing ':' separator.",
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
      selectQueue: ["video", "video:gif", "quality", "screen", "vibrant"],
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
          mode: "quality",
          gifProfile: "screen",
          gifLook: "vibrant",
          width: 320,
          fps: 12,
          overwrite: false,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a video command",
      "select:GIF mode",
      "select:GIF profile",
      "select:GIF look",
      "input:Width in px (optional)",
      "input:FPS (optional)",
      "confirm:Overwrite if exists?",
    ]);
  });

  test("routes a video flow through gif generation in compressed mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["video", "video:gif", "compressed"],
      requiredPathQueue: ["fixtures/input.mp4"],
      optionalPathQueue: ["fixtures/output.gif"],
      inputQueue: ["320", "12"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "video:gif",
        options: {
          input: "fixtures/input.mp4",
          output: "fixtures/output.gif",
          mode: "compressed",
          width: 320,
          fps: 12,
          overwrite: true,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a video command",
      "select:GIF mode",
      "input:Width in px (optional)",
      "input:FPS (optional)",
      "confirm:Overwrite if exists?",
    ]);
  });

  test("throws when a handler receives an unknown action", () => {
    const result = runInteractiveHarness({ mode: "invalid-data-action" }, { allowFailure: true });

    expect(result.error).toBe("Unhandled interactive action: data:unknown");
  });
});
