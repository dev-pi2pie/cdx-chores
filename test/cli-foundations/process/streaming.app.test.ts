import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("Node streaming process ownership", () => {
  for (const mode of [
    "records",
    "prefix",
    "metadata",
    "stderr",
    "progress",
    "args",
    "missing",
    "cancel",
    "input",
    "input-failure",
    "input-cancel",
  ])
    test(
      mode,
      () =>
        withTempFixtureDir("streaming-process", async (root) => {
          const bundle = join(root, "driver.mjs");
          const built = await Bun.build({
            entrypoints: [join(import.meta.dir, "fixtures/driver.ts")],
            target: "node",
          });
          expect(built.success).toBe(true);
          await Bun.write(bundle, built.outputs[0]!);
          const owned = startFixtureProcess({
            executable: "node",
            args: [bundle, mode, join(import.meta.dir, "fixtures/subject.cjs")],
            cwd: REPO_ROOT,
            env: { PATH: process.env.PATH },
            timeoutMs: 15000,
            graceMs: 500,
            cleanupMs: 4000,
            maxOutputBytes: 65536,
          });
          const result = await owned.completion;
          expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
          expect(result.ok, result.stderr).toBe(true);
          const observed = JSON.parse(result.stdout);
          expect(observed).toBeObject();
          if (mode === "cancel") {
            expect(observed).toMatchObject({
              cancelled: 2,
              graceMs: 2000,
              closureConfirmed: true,
              disposed: true,
              cooperative: {
                signals: ["SIGTERM"],
                termHandled: true,
                closeCode: 0,
                closeSignal: null,
              },
              resistant: {
                signals: ["SIGTERM", "SIGKILL"],
                termHandled: true,
                closeCode: null,
                closeSignal: "SIGKILL",
              },
            });
          } else if (mode === "input-cancel") {
            expect(observed).toMatchObject({
              inputCancelled: true,
              pendingWriteAtCancel: true,
              inputAborted: true,
              producerSettled: true,
              graceMs: 250,
              closureConfirmed: true,
              disposed: true,
              child: {
                signals: ["SIGTERM", "SIGKILL"],
                termHandled: true,
                closeCode: null,
                closeSignal: "SIGKILL",
              },
            });
          }
        }),
      20000,
    );
});
