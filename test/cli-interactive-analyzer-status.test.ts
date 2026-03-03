import { describe, expect, test } from "bun:test";

import { createInteractiveAnalyzerStatus } from "../src/cli/interactive/analyzer-status";

class CaptureStream {
  public text = "";
  public isTTY = false;

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

describe("interactive analyzer status", () => {
  test("prints simple status lines for non-tty streams", () => {
    const stream = new CaptureStream();
    const status = createInteractiveAnalyzerStatus(stream as unknown as NodeJS.WritableStream);

    status.start("Sampling filenames for cleanup analysis...");
    status.update("Waiting for Codex cleanup suggestions...");
    status.stop();

    expect(stream.text).toContain("Sampling filenames for cleanup analysis...\n");
    expect(stream.text).toContain("Waiting for Codex cleanup suggestions...\n");
  });

  test("uses a mutable tty status line and clears it on stop", async () => {
    const stream = new CaptureStream();
    stream.isTTY = true;
    const status = createInteractiveAnalyzerStatus(stream as unknown as NodeJS.WritableStream);

    status.start("Sampling filenames for cleanup analysis...");
    status.wait("Waiting for Codex cleanup suggestions...");
    await Bun.sleep(420);
    status.stop();

    expect(stream.text).toContain("\r\x1b[2K");
    expect(stream.text).toContain("Thinking");
    expect(stream.text).toContain("sampling");
    expect(stream.text).toContain("waiting");
  });
});
