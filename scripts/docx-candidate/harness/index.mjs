import { rm } from "node:fs/promises";
import { createColors } from "picocolors";

import { runOwnedCommand } from "./command.mjs";
import { HarnessError, safeId, safeLabel } from "./errors.mjs";
import { createOutputWriter } from "./output.mjs";

export { HarnessError } from "./errors.mjs";

/** Private driver presentation and ownership; no document bytes enter progress. */
export function createHarness({ title, scope }) {
  safeLabel(title);
  safeLabel(scope);
  const controller = new AbortController();
  const failOutput = (error) => controller.abort(error);
  const progress = createOutputWriter(process.stderr, failOutput);
  const result = createOutputWriter(process.stdout, failOutput);
  const heartbeatMs = process.stderr.isTTY ? 10_000 : 30_000;
  const colors = createColors(
    Boolean(process.stderr.isTTY) && !Object.hasOwn(process.env, "NO_COLOR"),
  );
  let active = "";
  let activeId;
  let total;
  let completed = 0;
  let started = performance.now();
  let activity = started;
  let timer;
  let running = false;
  let cleanupUnconfirmed = false;
  const cancel = () => controller.abort(new HarnessError("cancellation", active || "validation"));
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  const emit = async (text) => {
    await progress.write(text);
    activity = performance.now();
  };
  const stage = async (label) => {
    if (controller.signal.aborted) throw controller.signal.reason;
    active = safeLabel(label);
    activeId = undefined;
    total = undefined;
    completed = 0;
    started = performance.now();
    await emit(colors.cyan(`▶ ${label}\n`));
  };
  const event = async (value) => {
    if (value.event === "scope") {
      total = value.total;
      await emit(`  Selected: ${total} cases\n`);
    } else if (value.event === "start") {
      activeId = value.id;
      await emit(colors.dim(`  ${completed}/${total} checked · running ${activeId}\n`));
    } else if (value.event === "complete") {
      activeId = undefined;
      completed = value.completed;
      await emit(`  ${completed}/${total} checked\n`);
    }
  };
  return {
    get signal() {
      return controller.signal;
    },
    get cleanupUnconfirmed() {
      return cleanupUnconfirmed;
    },
    get processesSettled() {
      return !running && !cleanupUnconfirmed;
    },
    async start() {
      await emit(`${colors.bold(title)}\nScope: ${scope}\n`);
      timer = setInterval(() => {
        if (!active || performance.now() - activity < heartbeatMs || progress.failed) return;
        const detail =
          total === undefined
            ? ""
            : ` · ${completed}/${total} checked${activeId ? ` · ${activeId}` : ""}`;
        emit(
          colors.dim(
            `… ${active}${detail} · ${Math.floor((performance.now() - started) / 1000)}s waiting\n`,
          ),
        ).catch(failOutput);
      }, 1_000);
      timer.unref();
    },
    stage,
    async success(label) {
      active = "";
      await emit(colors.green(`✓ ${safeLabel(label)}\n`));
    },
    async command(path, args, options) {
      if (cleanupUnconfirmed) throw new HarnessError("cleanup", options.label, activeId);
      if (running) throw new HarnessError("runner", options.label);
      if (controller.signal.aborted) throw controller.signal.reason;
      await stage(options.label);
      running = true;
      try {
        const output = await runOwnedCommand(path, args, {
          ...options,
          signal: controller.signal,
          onProgress: event,
        });
        await emit(colors.green(`✓ ${options.label} completed\n`));
        active = "";
        return output;
      } catch (error) {
        cleanupUnconfirmed ||= error.cleanupUnconfirmed === true;
        if (controller.signal.aborted && controller.signal.reason instanceof HarnessError) {
          if (safeId(error.id)) controller.signal.reason.id ??= error.id;
          if (error instanceof HarnessError) controller.signal.reason.stage = error.stage;
        }
        throw error;
      } finally {
        running = false;
      }
    },
    async cleanup(workspace) {
      if (running || cleanupUnconfirmed) {
        cleanupUnconfirmed = true;
        throw new HarnessError("cleanup", "temporary artifacts", activeId);
      }
      try {
        await rm(workspace, { recursive: true, force: true });
      } catch {
        cleanupUnconfirmed = true;
        throw new HarnessError("cleanup", "temporary artifacts", activeId);
      }
      if (controller.signal.aborted) throw controller.signal.reason;
    },
    async failure(error) {
      active = "";
      const category = error instanceof HarnessError ? error.category : "runner";
      const label = error instanceof HarnessError ? safeLabel(error.stage) : "validation";
      const id = error instanceof HarnessError && safeId(error.id) ? ` · case ${error.id}` : "";
      await emit(
        (category === "cancellation" ? colors.yellow : colors.red)(
          `✗ ${label} · ${category}${id}\n`,
        ),
      );
    },
    async result(text) {
      await result.write(text);
    },
    async retainedLocation(path) {
      if (!/^examples\/playground\/docx-candidate\/smoke\/[A-Za-z0-9-]+$/.test(path))
        throw new HarnessError("output");
      await emit(`Retained smoke artifacts: ${path}\n`);
    },
    async finish() {
      clearInterval(timer);
      active = "";
      try {
        await progress.write("");
        await result.write("");
      } finally {
        process.removeListener("SIGINT", cancel);
        process.removeListener("SIGTERM", cancel);
        progress.dispose();
        result.dispose();
      }
      if (progress.failed || result.failed) throw new HarnessError("output");
      if (cleanupUnconfirmed) throw new HarnessError("cleanup", "temporary artifacts", activeId);
      if (controller.signal.aborted) throw controller.signal.reason;
    },
  };
}
