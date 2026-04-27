import { describe, expect, test } from "bun:test";

import {
  DEFAULT_DATA_STACK_TIMESTAMP,
  dataStackDefaultOutputMatcher,
  runDataStackInteractiveHarness,
  stripAnsi,
} from "./helpers";

describe("interactive data stack discovery", () => {
  test("lets interactive data stack recover through source discovery options before schema setup", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "options",
        "pattern",
        "options",
        "pattern",
        "accept",
        "strict",
        "json",
        "continue",
        "dry-run",
      ],
      optionalPathQueue: [undefined, undefined],
      inputQueue: ["*.txt", "*.csv"],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([]);
    expect(plainStderr).toContain("Matched-file preview failed:");
    expect(plainStderr).toContain("- pattern: *.csv");
    expect(plainStderr).toContain("- traversal: shallow only");
    expect(plainStderr).toContain("- matched files: 3");
    expect(plainStderr.indexOf("Dry-run path")).toBeLessThan(
      plainStderr.indexOf("Schema analysis"),
    );
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "input" && call.message === "Filename pattern",
      ),
    ).toHaveLength(2);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Matched files",
      ),
    ).toHaveLength(3);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Source discovery options",
      ),
    ).toHaveLength(2);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      inputFormat: "csv",
      pattern: "*.csv",
      recursive: false,
    });
  });

  test("keeps failed interactive data stack previews on recovery actions only", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "csv", "options", "pattern", "cancel"],
      inputQueue: ["*.txt"],
      confirmQueue: [false],
    });

    expect(result.actionCalls).toEqual([]);
    expect(stripAnsi(result.stderr)).toContain("Matched-file preview failed:");
    expect(result.selectChoicesByMessage["Matched files"]?.map((choice) => choice.value)).toEqual([
      "options",
      "sources",
      "cancel",
    ]);
    expect(stripAnsi(result.stderr)).toContain("Skipped stack write.");
  });

  test("keeps source discovery options for directories named like CSV files", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "options",
        "recursive",
        "accept",
        "strict",
        "json",
        "continue",
        "dry-run",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-directory-extension.csv"],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [false, true, true],
    });

    expect(result.selectChoicesByMessage["Matched files"]?.map((choice) => choice.value)).toEqual([
      "accept",
      "options",
      "sources",
      "cancel",
    ]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      fileCount: 2,
      inputFormat: "csv",
      recursive: true,
    });
  });

  test("lets interactive data stack toggle recursive discovery from source options", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "options",
        "recursive",
        "accept",
        "strict",
        "json",
        "continue",
        "dry-run",
      ],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([]);
    expect(plainStderr).toContain("- traversal: recursive");
    expect(
      result.selectChoicesByMessage["Source discovery options"]?.map((choice) => choice.value),
    ).toEqual(["pattern", "recursive", "format", "back"]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "select:Traversal mode",
    );
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      inputFormat: "csv",
      recursive: true,
    });
  });

  test("lets interactive data stack change input format from source options", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: [
        "data",
        "data:stack",
        "tsv",
        "options",
        "format",
        "csv",
        "accept",
        "strict",
        "json",
        "continue",
        "dry-run",
      ],
      optionalPathQueue: [undefined, undefined],
      confirmQueue: [false, true, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(result.actionCalls).toEqual([]);
    expect(plainStderr).toContain("Matched-file preview failed:");
    expect(plainStderr).toContain("- input format: CSV");
    expect(plainStderr).toContain("- pattern: format default (*.csv)");
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Input format",
      ),
    ).toHaveLength(2);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      inputFormat: "csv",
      recursive: false,
    });
  });

  test("skips the interactive data stack Codex checkpoint when diagnostics have no useful signals", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-no-codex-signal"],
      optionalPathQueue: [undefined],
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
      "select:Codex-powered analysis checkpoint",
    );
  });

  test("interactive data stack can analyze schema mode automatically", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "csv", "accept", "auto", "json", "continue", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-header-mismatch"],
      optionalPathQueue: [undefined],
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
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "cancel"],
      requiredPathQueue: [
        "examples/playground/stack-cases/csv-many-files/part-001.csv",
        "examples/playground/stack-cases/csv-many-files/part-002.csv",
        "examples/playground/stack-cases/csv-many-files/part-003.csv",
        "examples/playground/stack-cases/csv-many-files/part-004.csv",
        "examples/playground/stack-cases/csv-many-files/part-005.csv",
        "examples/playground/stack-cases/csv-many-files/part-006.csv",
      ],
      optionalPathQueue: [undefined],
      inputQueue: [],
      confirmQueue: [true, true, true, true, true, false, true],
    });
    const plainStderr = stripAnsi(result.stderr);

    expect(plainStderr).toContain("- input sources: 6");
    expect(plainStderr).toContain("- pattern: skipped for explicit file sources");
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
    expect(result.selectChoicesByMessage["Matched files"]?.map((choice) => choice.value)).toEqual([
      "accept",
      "sources",
      "cancel",
    ]);
    expect(
      result.selectChoicesByMessage["Matched files"]?.map((choice) => choice.value),
    ).not.toContain("options");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "input:Filename pattern",
    );
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "select:Traversal mode",
    );
  });

  test("routes interactive data stack with mixed file and directory sources", () => {
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
      requiredPathQueue: [
        "examples/playground/stack-cases/csv-matching-headers/part-001.csv",
        "examples/playground/stack-cases/csv-matching-headers",
      ],
      optionalPathQueue: [undefined],
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
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "json", "accept", "strict", "csv", "continue", "write"],
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
    const result = runDataStackInteractiveHarness({
      selectQueue: ["data", "data:stack", "jsonl", "accept", "strict", "json", "continue", "write"],
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
    const result = runDataStackInteractiveHarness({
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "union-by-name",
        "json",
        "continue",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-union"],
      optionalPathQueue: [undefined],
      inputQueue: ["noise"],
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
});
