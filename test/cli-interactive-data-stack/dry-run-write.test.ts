import { describe, expect, test } from "bun:test";

import {
  DEFAULT_DATA_STACK_TIMESTAMP,
  dataStackDefaultOutputMatcher,
  dataStackDefaultPathPattern,
  runInteractiveHarness,
  stripAnsi,
} from "./helpers";

describe("interactive data stack dry run write", () => {
  test("lets interactive data stack stop before writing at the final review checkpoint", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "csv", "continue", "cancel"],
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
      "select:Stack plan action",
    );
  });

  test("writes an interactive data stack dry-run plan without materialized output", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "dry-run"],
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
    expect(stripAnsi(result.stderr)).toMatch(
      /Replay later: cdx-chores data stack replay data-stack-plan-20260225T000000Z-[a-f0-9]{8}\.json/,
    );
  });

  test("rejects an interactive dry-run plan at the stack output path", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: [
          "data",
          "data:stack",
          "csv",
          "accept",
          "strict",
          "json",
          "continue",
          "dry-run",
        ],
        requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
        optionalPathQueue: ["fixtures/custom-stacked.json", "fixtures/custom-stacked.json"],
        inputQueue: ["*.csv"],
        confirmQueue: [false],
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("Stack plan path cannot be the same as stack output path");
    expect(result.stackPlanWrites).toHaveLength(0);
    expect(result.actionCalls).toEqual([]);
  });

  test("rejects an interactive dry-run plan at an input source path", () => {
    const inputPath = "examples/playground/stack-cases/json-array-basic/day-01.json";
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: [
          "data",
          "data:stack",
          "json",
          "accept",
          "strict",
          "json",
          "continue",
          "dry-run",
        ],
        requiredPathQueue: [inputPath],
        optionalPathQueue: ["fixtures/custom-stacked.json", inputPath],
        confirmQueue: [false],
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("Stack plan path cannot be the same as an input source");
    expect(result.stackPlanWrites).toHaveLength(0);
    expect(result.actionCalls).toEqual([]);
  });

  test("removes the interactive stack plan when write succeeds and keeping is declined", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
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
    expect(stripAnsi(result.stderr)).not.toContain("Replay later:");
  });

  test("keeps the interactive stack plan when materialized writing fails", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
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

  test("keeps the interactive stack plan when the final stack write finds an existing output", () => {
    const result = runInteractiveHarness(
      {
        mode: "run",
        selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
        requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
        optionalPathQueue: ["fixtures/custom-stacked.json"],
        confirmQueue: [false],
        dataStackWriteExistingPaths: ["fixtures/custom-stacked.json"],
      },
      { allowFailure: true },
    );

    expect(result.error).toContain("Output file already exists:");
    expect(result.actionCalls).toHaveLength(1);
    expect(result.stackPlanWrites).toHaveLength(1);
    expect(stripAnsi(result.stderr)).toContain("Keeping stack plan after failed write:");
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).not.toContain(
      "confirm:Keep stack plan?",
    );
  });

  test("uses the expected TSV default output metadata in interactive data stack", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "tsv", "continue", "cancel"],
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
        "accept",
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
    ).toHaveLength(0);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Output format",
      ),
    ).toHaveLength(2);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Stack plan action",
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
        "accept",
        "strict",
        "json",
        "continue",
        "review",
        "csv",
        "accept",
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
    ).toHaveLength(0);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Traversal mode",
      ),
    ).toHaveLength(0);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "select:Stack plan action",
    );
  });

  test("re-prompts stack destination when the generated default output exists and overwrite is declined", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
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
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
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
});
