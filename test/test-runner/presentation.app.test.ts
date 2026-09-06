import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";

import { createOutputDelivery } from "../../scripts/testing/execution/output.ts";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process.ts";
import {
  createPresentation,
  type PresentationClock,
} from "../../scripts/testing/terminal/presentation.ts";
import {
  renderSummary,
  type InvocationSummary,
  type LeafSummary,
} from "../../scripts/testing/terminal/summary.ts";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { completed } from "./runner-support.ts";

function destination(isTTY: boolean) {
  const chunks: Buffer[] = [];
  const stream = Object.assign(
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
    { isTTY },
  );
  return { stream, chunks, text: () => Buffer.concat(chunks).toString() };
}

function fakeClock() {
  let now = 0;
  const callbacks = new Set<() => void>();
  const clock: PresentationClock = {
    now: () => now,
    every(_milliseconds, callback) {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };
  return {
    clock,
    advance(milliseconds: number) {
      now += milliseconds;
      for (const callback of callbacks) callback();
    },
    timers: () => callbacks.size,
  };
}

function fixture(stdoutTTY = false, stderrTTY = false, env: NodeJS.ProcessEnv = {}) {
  const stdout = destination(stdoutTTY);
  const stderr = destination(stderrTTY);
  const destinations = { stdout: stdout.stream, stderr: stderr.stream };
  const output = createOutputDelivery(destinations);
  const time = fakeClock();
  const presentation = createPresentation(output, destinations, env, time.clock);
  return {
    stdout,
    stderr,
    output,
    presentation,
    time,
    dispose() {
      presentation.finish();
      output.dispose();
    },
  };
}

function leaf(overrides: Partial<LeafSummary> = {}): LeafSummary {
  return {
    suite: "app",
    state: "passed",
    errors: [],
    versions: { bun: "1.4.1", node: "24.0.0" },
    counts: {
      tests: 2,
      assertions: 5,
      failures: 0,
      errors: 0,
      skipped: 0,
      durationSeconds: 1.25,
      files: ["a.app.test.ts"],
    },
    processes: [{ stage: "test", result: completed() }],
    ...overrides,
  };
}

function summary(): InvocationSummary {
  return {
    schema: 1,
    selected: ["app"],
    keepResults: false,
    state: "passed",
    leaves: [leaf()],
    errors: [],
  };
}

describe("test terminal presentation", () => {
  test("starts immediately, preserves aggregate outcomes and never invents progress percentages", async () => {
    const context = fixture();
    expect(context.time.timers()).toBe(0);
    context.presentation.start(["unit", "app"], false);
    expect(context.stdout.text()).toContain("Selected: Unit, Application");
    expect(context.time.timers()).toBe(1);
    context.presentation.stage("unit", "Checking prerequisites");
    context.presentation.outcome(leaf({ suite: "unit" }));
    context.presentation.stage("app", "Running tests");
    context.presentation.testOutput.write("stderr", "(pass) informational test line\n");
    expect(await context.output.flush()).toBe(true);
    expect(context.stdout.text()).toContain("✓ Unit · passed · 2 cases · 5 assertions");
    expect(context.stdout.text()).toContain("▶ Application · Running tests");
    expect(context.stdout.text()).not.toContain("Application · passed");
    expect(context.stdout.text()).not.toContain("%");
    expect(context.stderr.text()).toBe("(pass) informational test line\n");
    context.dispose();
  });

  test.each([
    [true, 10_000],
    [false, 30_000],
  ] as const)(
    "emits append-only elapsed status after the quiet allowance (TTY=%s)",
    async (tty, quietMs) => {
      const context = fixture(tty, tty, { NO_COLOR: "" });
      context.presentation.start(["app"], true);
      context.presentation.stage("app", "Checking prerequisites");
      const before = context.stdout.text();
      context.time.advance(quietMs - 1);
      expect(context.stdout.text()).toBe(before);
      context.time.advance(1);
      expect(context.stdout.text()).toContain(
        `Checking prerequisites · ${quietMs / 1000}s elapsed`,
      );
      const firstStatus = context.stdout.text();
      context.time.advance(quietMs - 1);
      expect(context.stdout.text()).toBe(firstStatus);
      context.time.advance(1);
      expect(context.stdout.text()).toContain(`${(quietMs * 2) / 1000}s elapsed`);
      expect(context.stdout.text()).not.toContain("\x1b[");
      expect(context.stdout.text()).not.toContain("\r");
      context.presentation.finish();
      expect(context.time.timers()).toBe(0);
      const finished = context.stdout.text();
      context.time.advance(60_000);
      expect(context.stdout.text()).toBe(finished);
      await context.output.flush();
      context.dispose();
    },
  );

  test("raw activity postpones quiet status while split UTF-8 bytes pass unchanged", async () => {
    const context = fixture(true, true, { NO_COLOR: "" });
    context.presentation.start(["app"], false);
    context.presentation.stage("app", "Running tests");
    context.time.advance(9000);
    const bytes = Buffer.from("🐈\n");
    context.presentation.testOutput.write("stdout", bytes.subarray(0, 2));
    context.time.advance(30_000);
    expect(context.stdout.text()).not.toContain("elapsed");
    context.presentation.testOutput.write("stdout", bytes.subarray(2));
    context.time.advance(9999);
    expect(context.stdout.text()).not.toContain("elapsed");
    context.time.advance(1);
    expect(context.stdout.text()).toContain("49s elapsed");
    expect(Buffer.concat(context.stdout.chunks).includes(bytes)).toBe(true);
    expect(await context.output.flush()).toBe(true);
    context.dispose();
  });

  test("quiet status and stage transitions wait until both raw streams end their partial lines", async () => {
    const context = fixture();
    context.presentation.start(["app"], false);
    context.presentation.stage("app", "Running tests");
    context.presentation.testOutput.write("stdout", "out partial");
    context.presentation.testOutput.write("stderr", "err partial");
    context.presentation.stage("app", "Validating reports");
    context.time.advance(60_000);
    expect(context.stdout.text()).not.toContain("Validating reports");
    expect(context.stdout.text()).not.toContain("elapsed");
    context.presentation.testOutput.write("stdout", " complete\n");
    expect(context.stdout.text()).not.toContain("Validating reports");
    context.presentation.testOutput.write("stderr", " complete\n");
    expect(context.stdout.text()).toContain(
      "out partial complete\n▶ Application · Validating reports",
    );
    expect(context.stderr.text()).toBe("err partial complete\n");
    expect(await context.output.flush()).toBe(true);
    context.dispose();
  });

  test("a completed producer gets a newline on each original stream before the next stage", async () => {
    const context = fixture();
    context.presentation.testOutput.write("stdout", "unfinished out");
    context.presentation.testOutput.write("stderr", "unfinished err");
    context.presentation.stage("app", "Validating reports", { producerEnded: true });
    expect(await context.output.flush()).toBe(true);
    expect(context.stdout.text()).toBe("unfinished out\n▶ Application · Validating reports\n");
    expect(context.stderr.text()).toBe("unfinished err\n");
    context.dispose();
  });

  test.each([
    [true, true, {}, true, true],
    [true, false, {}, true, false],
    [false, true, {}, false, false],
    [false, false, { FORCE_COLOR: "1" }, false, false],
    [true, true, { NO_COLOR: "", FORCE_COLOR: "1" }, false, false],
    [true, true, { NO_COLOR: "0" }, false, false],
  ] as const)(
    "uses destination capabilities and NO_COLOR presence (stdout=%s stderr=%s env=%j)",
    async (stdoutTTY, stderrTTY, env, styled, childColored) => {
      const context = fixture(stdoutTTY, stderrTTY, env);
      context.presentation.start(["app"], false);
      context.presentation.stage("app", "Running tests");
      context.presentation.outcome(leaf());
      const childEnv = context.presentation.childEnvironment({
        PATH: "/synthetic",
        FORCE_COLOR: "9",
        NO_COLOR: "",
      });
      expect(childEnv.PATH).toBe("/synthetic");
      expect(childEnv.FORCE_COLOR).toBe(childColored ? "1" : undefined);
      expect(childEnv.NO_COLOR).toBe(childColored ? undefined : "1");
      expect(context.stdout.text().includes("\x1b[")).toBe(styled);
      expect(await context.output.flush()).toBe(true);
      context.dispose();
    },
  );

  test("summary keeps results and failure reasons above routine process diagnostics", () => {
    const context = fixture();
    const value = summary();
    value.state = "failed";
    value.leaves[0]!.state = "failed";
    value.leaves[0]!.errors.push("Required prerequisite missing.");
    value.errors.push("Cleanup failed.");
    const rendered = context.presentation.renderSummary(value);
    expect(rendered).toContain(
      "2 cases, 5 assertions, 0 failures, 0 errors, 0 skipped, 1 files, 1.25s",
    );
    expect(rendered).toContain("Versions: bun=1.4.1, node=24.0.0");
    expect(rendered).toContain("Required prerequisite missing.");
    expect(rendered).toContain("Run failure: Cleanup failed.");
    expect(rendered).toContain("No results were retained.");
    expect(rendered.indexOf("Process diagnostics:")).toBeGreaterThan(
      rendered.indexOf("Run failure:"),
    );
    expect(rendered).not.toContain("\x1b[");
    expect(renderSummary(value)).not.toContain("Process diagnostics:");
    context.dispose();
  });

  test("styled summary retains verified result and remaining ownership paths", async () => {
    await withTempFixtureDir("presentation-paths", async (root) => {
      const context = fixture(true, true);
      const value = summary();
      value.retainedResultsPath = root;
      value.remainingOwnedPath = root;
      const rendered = context.presentation.renderSummary(value);
      expect(rendered).toContain("\x1b[");
      expect(rendered).toContain("Retained results: " + root);
      expect(rendered).toContain("Remaining owned location: " + root);
      expect(rendered).not.toContain("No results were retained.");
      context.dispose();
    });
  });

  test("disposing the forwarding wrapper also stops presentation timers", async () => {
    const context = fixture();
    context.presentation.start(["app"], false);
    context.presentation.stage("app", "Running tests");
    expect(await context.output.flush()).toBe(true);
    context.presentation.testOutput.dispose();
    expect(context.time.timers()).toBe(0);
    context.time.advance(60_000);
    expect(context.output.failed).toBe(false);
  });

  test("early argument failure is readable and starts no background timer", () => {
    const context = fixture(true, true);
    const value = summary();
    value.state = "failed";
    value.selected = [];
    value.leaves = [];
    value.errors = ["Unknown test suite: invalid."];
    expect(context.presentation.renderSummary(value)).toContain("Unknown test suite: invalid.");
    expect(context.time.timers()).toBe(0);
    context.dispose();
  });

  test("output failure suppresses subsequent status and timer writes", () => {
    const context = fixture();
    context.presentation.start(["app"], false);
    context.presentation.stage("app", "Running tests");
    context.stdout.stream.emit("error", new Error("closed"));
    const snapshot = context.output.snapshot();
    context.presentation.stage("app", "Cleanup");
    context.time.advance(60_000);
    context.presentation.outcome(leaf({ state: "failed" }));
    expect(context.output.snapshot().observedBytes).toBe(snapshot.observedBytes);
    context.dispose();
  });
});

describe("installed Bun reporter through owned pipes", () => {
  test.each([
    [true, true, {}, true],
    [true, false, {}, false],
    [false, true, {}, false],
    [true, true, { NO_COLOR: "", FORCE_COLOR: "1" }, false],
    [false, false, { FORCE_COLOR: "1" }, false],
  ] as const)(
    "applies explicit reporter color policy (stdout=%s stderr=%s env=%j)",
    async (stdoutTTY, stderrTTY, env, expectedColor) => {
      await withTempFixtureDir("reporter-color", async (root) => {
        await writeFile(
          join(root, "reporter.test.ts"),
          'import {test,expect} from "bun:test"; test("reporter color",()=>expect(1).toBe(1));',
        );
        const context = fixture(stdoutTTY, stderrTTY, env);
        try {
          const result = await startFixtureProcess({
            executable: process.execPath,
            args: ["test", "./reporter.test.ts"],
            cwd: root,
            env: context.presentation.childEnvironment({
              PATH: process.env.PATH,
              TERM: "xterm-256color",
            }),
            timeoutMs: 2500,
            graceMs: 250,
            cleanupMs: 1500,
            maxOutputBytes: 8192,
          }).completion;
          expect(result.stopped).toBe(true);
          expect(result.ok).toBe(true);
          expect(result.stderr).toContain("1 pass");
          expect(result.stdout.includes("\x1b[")).toBe(expectedColor);
          expect(result.stderr.includes("\x1b[")).toBe(expectedColor);
        } finally {
          context.dispose();
        }
      });
    },
  );
});
