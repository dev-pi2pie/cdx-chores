import { describe, expect, test } from "bun:test";

import {
  dataStackDefaultOutputMatcher,
  runInteractiveHarness,
  stripAnsi,
} from "./cli-interactive-routing.helpers";

describe("interactive mode routing: data stack", () => {
  test("routes interactive data stack through shared stack execution", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "continue", "write"],
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
    expect(plainStderr).toContain("Source discovery");
    expect(plainStderr).toContain("Dry-run path");
    expect(plainStderr).toContain(
      "- save a replayable stack plan without writing output; later run data stack replay <record>",
    );
    expect(plainStderr).toContain("Stack review");
    expect(plainStderr).toContain("Input discovery");
    expect(plainStderr).toContain("Schema analysis");
    expect(plainStderr).toContain("Duplicate and key diagnostics");
    expect(plainStderr).toContain("Output target");
    expect(plainStderr).toContain("- input sources: 1");
    expect(plainStderr).toContain("- input format: CSV");
    expect(plainStderr).toContain("- pattern: format default (*.csv)");
    expect(plainStderr).toContain("- traversal: shallow only");
    expect(plainStderr).toContain("- schema mode: strict");
    expect(plainStderr).toContain("- output format: JSON");
    expect(plainStderr).toMatch(/- output: data-stack-20260330T000000Z-[a-f0-9]{8}\.json/);
    expect(plainStderr).toContain("- matched files: 3");
    expect(plainStderr).toContain("Codex-powered analysis checkpoint");
    expect(plainStderr).toContain("- signals: candidate unique keys");
    expect(result.codexReportWrites).toHaveLength(0);
    expect(
      result.selectChoicesByMessage["Codex-powered analysis checkpoint"]?.map(
        (choice) => choice.value,
      ),
    ).toEqual(["codex", "continue", "review", "cancel"]);
    expect(result.selectChoicesByMessage["Codex-powered analysis checkpoint"]?.[0]?.name).toBe(
      "Analyze with Codex",
    );
    expect(result.selectChoicesByMessage["Schema mode"]?.map((choice) => choice.value)).toEqual([
      "auto",
      "strict",
      "union-by-name",
    ]);
    expect(result.selectChoicesByMessage["Schema mode"]?.[0]?.name).toBe("Automatic schema check");
    expect(result.selectChoicesByMessage["Matched files"]?.map((choice) => choice.value)).toEqual([
      "accept",
      "options",
      "sources",
      "cancel",
    ]);
    expect(
      result.selectChoicesByMessage["Stack plan action"]?.map((choice) => choice.value),
    ).toEqual(["write", "dry-run", "review", "destination", "cancel"]);
    expect(plainStderr).toMatch(
      /Replay later: cdx-chores data stack replay data-stack-plan-20260330T000000Z-[a-f0-9]{8}\.json/,
    );
    expect(result.stderr).toContain("\u001b[33mReplay later:\u001b[39m");
    const escape = String.fromCharCode(27);
    expect(result.stderr).toContain(
      `${escape}[36mcdx-chores data stack replay data-stack-plan-20260330T000000Z-`,
    );
    expect(result.stderr).toContain(`.json${escape}[39m`);
  });
});
