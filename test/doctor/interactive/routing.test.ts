import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";

describe("doctor interactive routing", () => {
  test("routes the doctor Summary choice and records its explicit default", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor", "summary"],
    });

    expect(result.actionCalls).toEqual([
      { name: "doctor", options: { details: false, json: false } },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose doctor output",
    ]);
    expect(result.selectChoicesByMessage["Choose doctor output"]).toEqual([
      {
        name: "Summary",
        value: "summary",
        description: "Workflow readiness and recommended actions",
      },
      {
        name: "Details",
        value: "details",
        description: "Versions, checks, and capability evidence",
      },
      { name: "JSON", value: "json", description: "Machine-readable evidence" },
    ]);
    expect(result.selectDefaultsByMessage["Choose doctor output"]).toEqual(["summary"]);
    expect(result.pathCalls).toHaveLength(0);
  });

  test("routes the doctor Details choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor", "details"],
    });

    expect(result.actionCalls).toEqual([
      { name: "doctor", options: { details: true, json: false } },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose doctor output",
    ]);
    expect(result.pathCalls).toHaveLength(0);
  });

  test("routes the doctor JSON choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor", "json"],
    });

    expect(result.actionCalls).toEqual([
      { name: "doctor", options: { details: false, json: true } },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose doctor output",
    ]);
    expect(result.pathCalls).toHaveLength(0);
  });
});
