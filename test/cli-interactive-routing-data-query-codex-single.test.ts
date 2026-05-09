import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data query Codex single source", () => {
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
});
