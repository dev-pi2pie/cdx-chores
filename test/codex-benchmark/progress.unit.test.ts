import { expect, test } from "bun:test";
import { Writable } from "node:stream";

import { createBenchmarkProgress } from "../../src/cli/codex-bench/progress";
import { getDisplayWidth } from "../../src/cli/text-display-width";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

test("resize during a streaming pause redraws and clears the old wrapped rows", () => {
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
    { now: () => elapsed },
  );
  try {
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
    expect(stdout.text).toBe("");
  } finally {
    progress.stop();
  }
  expect(chunks.slice(-3).join("")).toBe("\r\u001b[2K\r");
  expect(stderr.listenerCount("resize")).toBe(0);
  const finalLength = chunks.length;
  stderr.emit("resize");
  expect(chunks).toHaveLength(finalLength);
});
