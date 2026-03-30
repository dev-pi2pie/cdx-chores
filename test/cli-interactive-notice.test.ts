import { describe, expect, test } from "bun:test";

import { getInteractiveAbortNotice } from "../src/cli/interactive/notice";
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

describe("interactive notice helpers", () => {
  test("returns no abort notice outside tty mode", () => {
    expect(getInteractiveAbortNotice(createRuntime({ isTTY: false }))).toBeUndefined();
  });

  test("returns the narrow abort notice for small tty widths", () => {
    expect(getInteractiveAbortNotice(createRuntime({ columns: 20, isTTY: true }))).toBe(
      "Ctrl+C to abort.",
    );
  });

  test("returns the medium abort notice for mid-size tty widths", () => {
    expect(getInteractiveAbortNotice(createRuntime({ columns: 30, isTTY: true }))).toBe(
      "Press Ctrl+C to abort.",
    );
  });

  test("returns the wide abort notice for wider tty widths", () => {
    expect(getInteractiveAbortNotice(createRuntime({ columns: 80, isTTY: true }))).toBe(
      "Press Ctrl+C to abort this session.",
    );
  });
});
