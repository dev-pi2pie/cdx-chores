import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";

import { runCli as runCliInProcess } from "../src/command";
import { createTempFixtureDir, toRepoRelativePath, createCapturedRuntime } from "./helpers/cli-test-utils";

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

function enableTty(stream: NodeJS.WritableStream, columns = 80): void {
  const ttyStream = stream as NodeJS.WritableStream & { columns?: number; isTTY?: boolean };
  ttyStream.isTTY = true;
  ttyStream.columns = columns;
}

describe("CLI color controls", () => {
  test("global --no-color disables preview styling in TTY mode", async () => {
    const fixtureDir = await createTempFixtureDir("cli-color");
    try {
      const inputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");
      const { runtime, stdout, stderr } = createCapturedRuntime();
      enableTty(runtime.stdout, 80);

      await runCliInProcess(
        [process.execPath, "src/bin.ts", "data", "preview", toRepoRelativePath(inputPath), "--no-color"],
        runtime,
      );

      expect(stderr.text).toBe("");
      expect(stdout.text).not.toMatch(ANSI_PATTERN);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("NO_COLOR disables preview styling in TTY mode", async () => {
    const fixtureDir = await createTempFixtureDir("cli-color");
    const original = process.env.NO_COLOR;
    try {
      process.env.NO_COLOR = "1";
      const inputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");
      const { runtime, stdout, stderr } = createCapturedRuntime();
      enableTty(runtime.stdout, 80);

      await runCliInProcess(
        [process.execPath, "src/bin.ts", "data", "preview", toRepoRelativePath(inputPath)],
        runtime,
      );

      expect(stderr.text).toBe("");
      expect(stdout.text).not.toMatch(ANSI_PATTERN);
    } finally {
      if (original === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = original;
      }
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
