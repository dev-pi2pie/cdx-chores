import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Writable } from "node:stream";

import { createHarness } from "../../../scripts/docx-candidate/harness/index.mjs";

const [mode, workspace] = process.argv.slice(2);
const subject = new URL("./docx-harness-subject.cjs", import.meta.url).pathname;
let progress = "";
let settled = false;
let sawEarlyProgress = false;
const stderr = new Writable({
  write(chunk, _encoding, callback) {
    progress += chunk.toString();
    if (!settled && progress.includes("running synthetic-case")) sawEarlyProgress = true;
    callback();
  },
});
const stdout = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const h = createHarness({
  title: "Synthetic validation",
  scope: mode,
  stderr,
  stdout,
  heartbeatMs: 25,
});
await mkdir(workspace);
await h.start();
let timer;
const pidFile = join(workspace, "subject.pid");
try {
  const output = h.command(
    mode === "startup" ? join(workspace, "missing") : process.execPath,
    [subject, mode, pidFile],
    {
      stage: "comparison",
      label: "Synthetic command",
      cwd: workspace,
      env: { SystemRoot: process.env.SystemRoot },
      timeout: mode === "timeout" || mode === "unconfirmed" ? 1_500 : 5000,
      cleanupMs: mode === "unconfirmed" ? 1 : 1_500,
      maxOutputBytes: mode === "overflow" ? 4096 : 65536,
      progress: ["progress", "failure", "timeout", "cancel", "cancel-term", "unconfirmed"].includes(
        mode,
      ),
    },
  );
  if (mode === "cancel" || mode === "cancel-term") {
    timer = setInterval(() => {
      if (
        existsSync(pidFile) &&
        progress.includes("running resource-maxPartDecompressedBytes-at")
      ) {
        clearInterval(timer);
        process.kill(process.pid, mode === "cancel" ? "SIGINT" : "SIGTERM");
      }
    }, 10);
  }
  const expected = {
    startup: "startup",
    timeout: "timeout",
    cancel: "cancellation",
    "cancel-term": "cancellation",
    overflow: "output",
    failure: "comparison",
    unconfirmed: "cleanup",
  }[mode];
  if (expected) {
    await assert.rejects(output, (error) => {
      assert.equal(error.category, expected);
      if (mode === "failure") assert.equal(error.id, "synthetic-case");
      if (["timeout", "cancel", "cancel-term", "unconfirmed"].includes(mode))
        assert.equal(error.id, "resource-maxPartDecompressedBytes-at");
      return true;
    });
  } else {
    assert.equal(await output, mode === "progress" ? "stable result\n" : "");
  }
  settled = true;
  if (mode === "progress") {
    assert.equal(sawEarlyProgress, true);
    assert.match(progress, /1\/1 checked/);
  }
  if (mode === "unconfirmed") {
    assert.equal(h.cleanupUnconfirmed, true);
    await assert.rejects(h.cleanup(workspace), {
      category: "cleanup",
      id: "resource-maxPartDecompressedBytes-at",
    });
    assert.equal(existsSync(workspace), true);
    await delay(400);
    const pid = Number(await readFile(pidFile, "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    await assert.rejects(h.finish(), {
      category: "cleanup",
      id: "resource-maxPartDecompressedBytes-at",
    });
    process.stdout.write("passed yes\n");
    process.exitCode = 0;
  } else {
    if (["timeout", "cancel", "cancel-term", "descendant", "descendant-pipes"].includes(mode)) {
      const pid = Number(await readFile(pidFile, "utf8"));
      assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    }
    assert.equal(h.cleanupUnconfirmed, false);
    if (mode === "cancel" || mode === "cancel-term")
      await assert.rejects(h.cleanup(workspace), {
        category: "cancellation",
        id: "resource-maxPartDecompressedBytes-at",
      });
    else await h.cleanup(workspace);
    assert.equal(existsSync(workspace), false);
    if (mode === "cancel" || mode === "cancel-term")
      await assert.rejects(h.finish(), { category: "cancellation" });
    else await h.finish();
    process.stdout.write("passed yes\n");
  }
} finally {
  clearInterval(timer);
  // Fixture errors must still stop owned commands before the outer owner cleans.
  await delay(0);
}
