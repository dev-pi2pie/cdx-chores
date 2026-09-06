import { describe, expect, test } from "bun:test";

import { startAnalyzerProgress } from "../../../src/cli/actions/rename/codex/testing";
import type { CliRuntime } from "../../../src/cli/types";

class CapturedTtyStream {
  public isTTY = true;
  public chunks: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(String(chunk));
    return true;
  }
}

function createProgressRuntime(stdout: CapturedTtyStream): CliRuntime {
  return {
    cwd: process.cwd(),
    colorEnabled: false,
    now: () => new Date("2026-02-25T03:04:05.000Z"),
    platform: process.platform,
    stdout: stdout as unknown as NodeJS.WritableStream,
    stderr: new CapturedTtyStream() as unknown as NodeJS.WritableStream,
    stdin: { isTTY: false } as NodeJS.ReadStream,
    displayPathStyle: "relative",
  };
}

describe("rename analyzer progress presentation", () => {
  test("startAnalyzerProgress renders and stops the TTY spinner", () => {
    const stdout = new CapturedTtyStream();
    const progress = startAnalyzerProgress(
      createProgressRuntime(stdout),
      "Codex: analyzing 1 file",
    );

    try {
      progress.stop("fallback");
    } finally {
      expect(stdout.chunks[0]).toBe("\rCodex: analyzing 1 file... -");
      expect(stdout.chunks.at(-1)).toBe("\rCodex: analyzing 1 file... fallback\n");
    }
  });

  test("startAnalyzerProgress renders one progress line on non-TTY output", () => {
    const stdout = new CapturedTtyStream();
    stdout.isTTY = false;
    const progress = startAnalyzerProgress(
      createProgressRuntime(stdout),
      "Codex: analyzing 1 file",
    );

    progress.stop("done");

    expect(stdout.chunks).toEqual(["Codex: analyzing 1 file...\n"]);
  });
});
