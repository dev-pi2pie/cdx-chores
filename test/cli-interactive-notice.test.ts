import { describe, expect, test } from "bun:test";

import { resolveCliColorEnabled } from "../src/cli/colors";
import { getInteractiveAbortNotice, writeInteractiveTip } from "../src/cli/interactive/notice";
import type { CliRuntime } from "../src/cli/types";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

class CaptureStream {
  public text = "";
  public columns?: number;
  public isTTY?: boolean;

  public write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

function createRuntime(options: {
  colorEnabled?: boolean;
  columns?: number;
  isTTY?: boolean;
  stderrIsTTY?: boolean;
}): CliRuntime {
  const stdout = new CaptureStream();
  stdout.columns = options.columns;
  stdout.isTTY = options.isTTY;
  const stderr = new CaptureStream();
  stderr.isTTY = options.stderrIsTTY;
  return {
    cwd: process.cwd(),
    colorEnabled: options.colorEnabled ?? true,
    now: () => new Date("2026-03-30T00:00:00.000Z"),
    platform: process.platform,
    stdout: stdout as unknown as NodeJS.WritableStream,
    stderr: stderr as unknown as NodeJS.WritableStream,
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

  test("keeps a stderr tip plain when only stdout is a tty", () => {
    const runtime = createRuntime({ columns: 80, isTTY: true, stderrIsTTY: false });

    writeInteractiveTip(runtime, "Review this output.");

    expect((runtime.stderr as unknown as CaptureStream).text).toBe(
      "\nTip: Review this output.\n\n",
    );
  });

  test("colors a stderr tip when only stderr is a tty", () => {
    const runtime = createRuntime({ isTTY: false, stderrIsTTY: true });

    writeInteractiveTip(runtime, "Review this output.");

    const text = (runtime.stderr as unknown as CaptureStream).text;
    expect(text).toContain("\u001b[36mTip:\u001b[39m");
    expect(text).toContain("\u001b[2mReview this output.\u001b[22m");
    expect(text.replace(ANSI_PATTERN, "")).toBe("\nTip: Review this output.\n\n");
    expect((runtime.stdout as unknown as CaptureStream).text).toBe("");
  });

  test("keeps a stderr tip plain when runtime color is disabled", () => {
    const runtime = createRuntime({ colorEnabled: false, isTTY: true, stderrIsTTY: true });

    writeInteractiveTip(runtime, "Review this output.");

    expect((runtime.stderr as unknown as CaptureStream).text).toBe(
      "\nTip: Review this output.\n\n",
    );
  });

  test("keeps a stderr tip plain when runtime resolution sees NO_COLOR", () => {
    const runtime = createRuntime({
      colorEnabled: resolveCliColorEnabled({ env: { NO_COLOR: "1" } }),
      isTTY: true,
      stderrIsTTY: true,
    });

    writeInteractiveTip(runtime, "Review this output.");

    expect((runtime.stderr as unknown as CaptureStream).text).toBe(
      "\nTip: Review this output.\n\n",
    );
  });
});
