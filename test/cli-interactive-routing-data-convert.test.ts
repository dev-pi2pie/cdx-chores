import { describe, expect, test } from "bun:test";

import { REPO_ROOT, runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data convert", () => {
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
});
