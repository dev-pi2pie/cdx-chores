import { createColors } from "picocolors";
import type { Writable } from "node:stream";

import type { OutputChannel, OutputDelivery } from "../execution/output.ts";
import type { Suite } from "../suites/selection.ts";
import { renderSummary, type InvocationSummary, type LeafSummary } from "./summary.ts";

export interface PresentationDestinations {
  stdout: Writable & { isTTY?: boolean };
  stderr: Writable & { isTTY?: boolean };
}

/** Internal deterministic clock seam; never exposed as invocation flags. */
export interface PresentationClock {
  now(): number;
  every(milliseconds: number, callback: () => void): () => void;
}

export interface TestPresentation {
  /** Only selected test bytes pass through this wrapper, never private probes. */
  testOutput: OutputDelivery;
  start(selected: readonly Suite[], keepResults: boolean): void;
  stage(suite: Suite | undefined, label: string, options?: { producerEnded?: boolean }): void;
  outcome(leaf: LeafSummary): void;
  childEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  renderSummary(summary: InvocationSummary): string;
  finish(): void;
}

const SUITE_NAMES: Record<Suite, string> = {
  unit: "Unit",
  app: "Application",
  codex: "Codex",
  pandoc: "Pandoc",
};

const realClock: PresentationClock = {
  now: () => performance.now(),
  every(milliseconds, callback) {
    const timer = setInterval(callback, milliseconds);
    timer.unref();
    return () => clearInterval(timer);
  },
};

/** Append-only status leaves streamed test lines intact in terminals and logs. */
export function createPresentation(
  output: OutputDelivery,
  destinations: PresentationDestinations,
  sourceEnv: NodeJS.ProcessEnv,
  clock: PresentationClock = realClock,
): TestPresentation {
  const noColor = Object.prototype.hasOwnProperty.call(sourceEnv, "NO_COLOR");
  const colorEnabled = Boolean(destinations.stdout.isTTY) && !noColor;
  const colors = createColors(colorEnabled);
  const quietMs = destinations.stdout.isTTY ? 10_000 : 30_000;
  const partial: Record<OutputChannel, boolean> = { stdout: false, stderr: false };
  let lastActivity = clock.now();
  let stageStarted = lastActivity;
  let active = "";
  let pendingStage: string | undefined;
  let finished = false;
  const atBoundary = () => !partial.stdout && !partial.stderr;
  const emit = (text: string) => {
    if (!finished && !output.failed) {
      output.write("stdout", text);
      lastActivity = clock.now();
    }
  };
  const emitPendingStage = () => {
    if (pendingStage !== undefined && atBoundary()) {
      emit(pendingStage);
      pendingStage = undefined;
    }
  };
  const closeProducerLines = () => {
    for (const channel of ["stdout", "stderr"] as const) {
      if (partial[channel]) {
        if (!output.failed) output.write(channel, "\n");
        partial[channel] = false;
      }
    }
  };
  let cancelTimer: (() => void) | undefined;
  const quietStatus = () => {
    if (
      finished ||
      output.failed ||
      !active ||
      !atBoundary() ||
      clock.now() - lastActivity < quietMs
    )
      return;
    emit(colors.dim(`… ${active} · ${Math.floor((clock.now() - stageStarted) / 1000)}s elapsed\n`));
  };

  const finish = () => {
    if (finished) return;
    cancelTimer?.();
    active = "";
    pendingStage = undefined;
    finished = true;
  };

  const testOutput: OutputDelivery = {
    signal: output.signal,
    get failed() {
      return output.failed;
    },
    get issues() {
      return output.issues;
    },
    write(channel, chunk, source) {
      const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      if (bytes.length > 0) {
        partial[channel] = bytes[bytes.length - 1] !== 0x0a;
        lastActivity = clock.now();
      }
      output.write(channel, chunk, source);
      emitPendingStage();
    },
    flush: (sources) => output.flush(sources),
    snapshot: () => output.snapshot(),
    fallback: (text) => output.fallback(text),
    dispose() {
      finish();
      output.dispose();
    },
  };

  return {
    testOutput,
    start(selected, keepResults) {
      if (finished || output.failed) return;
      cancelTimer ??= clock.every(1000, quietStatus);
      emit(colors.bold("cdx-chores · tests") + "\n");
      emit(
        `Selected: ${selected.map((suite) => SUITE_NAMES[suite]).join(", ")} · ${keepResults ? "keep results" : "temporary results"}\n`,
      );
    },
    stage(suite, label, options = {}) {
      if (finished) return;
      if (options.producerEnded) closeProducerLines();
      active = suite ? `${SUITE_NAMES[suite]} · ${label}` : label;
      stageStarted = clock.now();
      pendingStage = colors.cyan(`▶ ${active}\n`);
      emitPendingStage();
    },
    outcome(leaf) {
      if (finished) return;
      closeProducerLines();
      pendingStage = undefined;
      active = "";
      const status =
        leaf.state === "passed"
          ? colors.green
          : leaf.state === "failed"
            ? colors.red
            : colors.yellow;
      const marker = leaf.state === "passed" ? "✓" : leaf.state === "failed" ? "✗" : "–";
      const counts = leaf.counts
        ? ` · ${leaf.counts.tests} cases · ${leaf.counts.assertions} assertions`
        : "";
      emit(status(`${marker} ${SUITE_NAMES[leaf.suite]} · ${leaf.state}${counts}\n`));
    },
    childEnvironment(env) {
      const result = { ...env };
      delete result.FORCE_COLOR;
      delete result.NO_COLOR;
      // Bun receives pipes. Its reporter is explicitly colored only when both
      // eventual destinations are terminals; mixed redirection stays plain.
      if (destinations.stdout.isTTY && destinations.stderr.isTTY && !noColor) {
        result.FORCE_COLOR = "1";
      } else {
        result.NO_COLOR = "1";
      }
      return result;
    },
    renderSummary: (summary) =>
      renderSummary(summary, { color: colorEnabled, groupProcessDetails: true }),
    finish,
  };
}
