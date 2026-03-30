import { describe, expect, test } from "bun:test";

import {
  buildInteractiveFlowTipPool,
  getInteractiveFlowTip,
  getInteractiveFlowStaticTips,
  pickInteractiveFlowTip,
  resolveInteractiveFlowTipSelectionValue,
} from "../src/cli/interactive/contextual-tip";
import type { CliRuntime } from "../src/cli/types";

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

  test("builds the expected randomized pool for data query", () => {
    expect(buildInteractiveFlowTipPool("data-query", "Press Ctrl+C to abort this session.")).toEqual([
      "Press Ctrl+C to abort this session.",
      "Manual is best for joins or custom SQL.",
      "SQL limit and preview rows are separate controls.",
      "Rows to show only affects terminal preview.",
    ]);
  });

  test("builds the expected randomized pool for data extract", () => {
    expect(buildInteractiveFlowTipPool("data-extract", "Press Ctrl+C to abort this session.")).toEqual([
      "Press Ctrl+C to abort this session.",
      "Source interpretation is reviewed before output setup.",
      "Change destination keeps the current extraction setup.",
    ]);
  });
});

describe("interactive flow tip selection", () => {
  test("picks the first tip for a zero-ish random value", () => {
    expect(pickInteractiveFlowTip(["a", "b", "c"], 0)).toBe("a");
  });

  test("picks the last tip for a near-one random value", () => {
    expect(pickInteractiveFlowTip(["a", "b", "c"], 0.999)).toBe("c");
  });

  test("selects the expected query tip for a deterministic random value", () => {
    expect(getInteractiveFlowTip(createRuntime({ columns: 80, isTTY: true }), "data-query", 0.3)).toBe(
      "Manual is best for joins or custom SQL.",
    );
  });

  test("selects the expected extract tip for a deterministic random value", () => {
    expect(
      getInteractiveFlowTip(createRuntime({ columns: 80, isTTY: true }), "data-extract", 0.9),
    ).toBe("Change destination keeps the current extraction setup.");
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
