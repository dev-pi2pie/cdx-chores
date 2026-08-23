import { describe, expect, test } from "bun:test";

import {
  buildInteractiveFlowTipPool,
  getInteractiveFlowTip,
  getInteractiveFlowStaticTips,
  pickInteractiveFlowTip,
  resolveInteractiveFlowTipSelectionValue,
} from "../../../src/cli/interactive/contextual-tip";
import type { CliRuntime } from "../../../src/cli/types";

function createRuntime(options: { columns?: number; isTTY?: boolean }): CliRuntime {
  return {
    cwd: process.cwd(),
    colorEnabled: true,
    now: () => new Date("2026-03-30T00:00:00.000Z"),
    platform: process.platform,
    stdout: {
      columns: options.columns,
      isTTY: options.isTTY,
      write() {
        return true;
      },
    } as unknown as NodeJS.WritableStream,
    stderr: {
      write() {
        return true;
      },
    } as unknown as NodeJS.WritableStream,
    stdin: process.stdin,
    displayPathStyle: "relative",
  };
}

describe("interactive flow tip pools", () => {
  test("returns the expected static tips for data query", () => {
    expect(getInteractiveFlowStaticTips("data-query")).toEqual([
      "Manual is best for joins or custom SQL.",
      "SQL limit and preview rows are separate controls.",
      "Rows to show only affects terminal preview.",
    ]);
  });

  test("returns the expected static tips for data extract", () => {
    expect(getInteractiveFlowStaticTips("data-extract")).toEqual([
      "Source interpretation is reviewed before output setup.",
      "Change destination keeps the current extraction setup.",
    ]);
  });

  test("returns the expected static tips for data stack", () => {
    expect(getInteractiveFlowStaticTips("data-stack")).toEqual([
      "Pattern filtering only affects files discovered from the input directory.",
      "Review matched files before writing the stacked output.",
    ]);
  });

  test.each([
    {
      flow: "Query",
      flowKind: "data-query" as const,
      expected: [
        "Press Ctrl+C to abort this session.",
        "Manual is best for joins or custom SQL.",
        "SQL limit and preview rows are separate controls.",
        "Rows to show only affects terminal preview.",
      ],
    },
    {
      flow: "Extract",
      flowKind: "data-extract" as const,
      expected: [
        "Press Ctrl+C to abort this session.",
        "Source interpretation is reviewed before output setup.",
        "Change destination keeps the current extraction setup.",
      ],
    },
    {
      flow: "Stack",
      flowKind: "data-stack" as const,
      expected: [
        "Press Ctrl+C to abort this session.",
        "Pattern filtering only affects files discovered from the input directory.",
        "Review matched files before writing the stacked output.",
      ],
    },
  ])("prepends the abort notice to the selected flow's static tips for $flow", (scenario) => {
    expect(
      buildInteractiveFlowTipPool(scenario.flowKind, "Press Ctrl+C to abort this session."),
    ).toEqual([...scenario.expected]);
  });
});

describe("interactive flow tip selection", () => {
  test("picks the first tip for a zero-ish random value", () => {
    expect(pickInteractiveFlowTip(["a", "b", "c"], 0)).toBe("a");
  });

  test("picks the last tip for a near-one random value", () => {
    expect(pickInteractiveFlowTip(["a", "b", "c"], 0.999)).toBe("c");
  });

  test.each([
    {
      flow: "Query",
      flowKind: "data-query" as const,
      randomValue: 0.3,
      expected: "Manual is best for joins or custom SQL.",
    },
    {
      flow: "Extract",
      flowKind: "data-extract" as const,
      randomValue: 0.9,
      expected: "Change destination keeps the current extraction setup.",
    },
    {
      flow: "Stack",
      flowKind: "data-stack" as const,
      randomValue: 0.9,
      expected: "Review matched files before writing the stacked output.",
    },
  ])("composes the $flow catalog and deterministic selector", (scenario) => {
    expect(
      getInteractiveFlowTip(
        createRuntime({ columns: 80, isTTY: true }),
        scenario.flowKind,
        scenario.randomValue,
      ),
    ).toBe(scenario.expected);
  });

  test("derives the selection value from runtime milliseconds", () => {
    expect(
      resolveInteractiveFlowTipSelectionValue({
        ...createRuntime({ columns: 80, isTTY: true }),
        now: () => new Date("2026-03-30T00:00:00.300Z"),
      }),
    ).toBe(0.3);
  });
});
