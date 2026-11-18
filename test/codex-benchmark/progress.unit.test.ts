import { expect, test } from "bun:test";
import { Writable } from "node:stream";

import { createBenchmarkProgress } from "../../src/cli/codex-bench/progress";
import { getDisplayWidth } from "../../src/cli/text-display-width";
import { createReflowingTerminalBlock } from "../../src/cli/tui/reflowing-block";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

test.each([false, true])(
  "resize during a streaming pause reflows the line (transient=%s)",
  (transient) => {
    const { runtime, stdout } = createCapturedRuntime({ colorEnabled: false });
    const chunks: string[] = [];
    const stderr = Object.assign(
      new Writable({
        write(chunk, _encoding, done) {
          chunks.push(String(chunk));
          done();
        },
      }),
      { isTTY: true, columns: 110 },
    );
    runtime.stderr = stderr;
    let elapsed = 0;
    const progress = createBenchmarkProgress(
      runtime,
      { models: ["fixture-模型"], speeds: ["fast"], runs: 3 },
      { transient, now: () => elapsed },
    );
    try {
      expect(chunks.join("")).toBe(
        transient ? "" : "1 combination · 3 measured trials + 1 warm-up\n",
      );
      progress.start({
        model: "fixture-模型",
        requestedSpeed: "fast",
        provider: null,
        reasoningEffort: null,
        warmup: true,
        round: 0,
      });
      expect(chunks.at(-1)).toContain("Fast requested · Warm-up · Waiting for text");
      progress.firstText();
      expect(chunks.at(-1)).toContain("Streaming");

      const beforeResize = chunks.length;
      elapsed = 2_500;
      stderr.columns = 25;
      stderr.emit("resize");
      expect(chunks.slice(beforeResize).join("")).toContain("\u001b[1B\r");
      const next = chunks.at(-1)!;
      expect(next).toBe("[1/4] Streaming · 2.5 s");
      expect(getDisplayWidth(next)).toBeLessThan(stderr.columns);

      stderr.columns = 110;
      stderr.emit("resize");
      expect(chunks.at(-1)).toBe(
        "[1/4] fixture-模型 · Fast requested · Warm-up · Streaming · 2.5 s elapsed",
      );
      expect(stdout.text).toBe("");
    } finally {
      progress.stop();
    }
    expect(chunks.slice(-3).join("")).toBe("\r\u001b[2K\r");
    expect(stderr.listenerCount("resize")).toBe(0);
    const finalLength = chunks.length;
    stderr.emit("resize");
    expect(chunks).toHaveLength(finalLength);
  },
);

test("clears each row when wide characters move to the next row after a shrink", () => {
  const { stdout } = createCapturedRuntime();
  const terminal = Object.assign(stdout, { columns: 12 }) as unknown as NodeJS.WriteStream;
  const frame = createReflowingTerminalBlock(terminal);
  frame.render(["aa模型"], "aa模型");
  terminal.columns = 3;
  frame.clear();
  expect(stdout.text).toBe("aa模型\r\x1b[2A\x1b[2K\x1b[1B\r\x1b[2K\x1b[1B\r\x1b[2K\r\x1b[2A");
});
