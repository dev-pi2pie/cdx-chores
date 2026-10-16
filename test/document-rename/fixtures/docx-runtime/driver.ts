import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { resolveDocxLimits } from "../../../../src/docx/limits";
import { createDocxSupervisorForTesting } from "../../../../src/docx/runtime/index";
import type { DocxReadResult } from "../../../../src/docx/types";

const mode = process.argv[2]!;
const workspace = process.argv[3]!;
const input = join(workspace, "input.docx");
const supervisor = (entry = "tracked-child", extra = {}) =>
  createDocxSupervisorForTesting({
    childPath: join(workspace, `${entry}.mjs`),
    cwd: workspace,
    ...extra,
  });
const failure = (result: DocxReadResult, diagnostic: string) =>
  assert.deepEqual(result, { ok: false, diagnostic });
async function stopped() {
  const pid = Number(await readFile(join(workspace, "child-pid"), "utf8"));
  assert(Number.isSafeInteger(pid) && pid > 0);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
}
async function waitFor(name: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(join(workspace, name))) return;
    await delay(10);
  }
  throw new Error("Synthetic child did not become ready");
}
async function noFurtherWrites(name: string) {
  const before = await readFile(join(workspace, name), "utf8");
  await delay(50);
  assert.equal(await readFile(join(workspace, name), "utf8"), before);
}
async function waitStopped() {
  const pid = Number(await readFile(join(workspace, "child-pid"), "utf8"));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
      throw error;
    }
    await delay(10);
  }
  throw new Error("Child shutdown did not settle");
}

if (mode === "guarded") {
  const result = await supervisor().read(input);
  assert(result.ok, JSON.stringify(result));
  assert.equal(result.facts.rawText, "Independent runtime report\n\n");
  await stopped();
} else if (mode === "caller-heap") {
  const retained = Array(32 * 1024 * 1024).fill(7);
  const peakRssBytes = 192 * 1024 * 1024;
  assert(process.memoryUsage.rss() > peakRssBytes);
  const result = await supervisor().read(input, { limits: { peakRssBytes } });
  assert(result.ok, JSON.stringify(result));
  assert.equal(retained.at(-1), 7);
  await stopped();
} else if (mode === "deadline") {
  const started = performance.now();
  const result = await supervisor("blocked-child").read(input, {
    limits: { elapsedMilliseconds: 800 },
  });
  failure(result, "docx_limit:elapsedMilliseconds");
  assert(performance.now() - started < 3_000);
  await stopped();
  await noFurtherWrites("worker-heartbeat");
} else if (mode === "cancel" || mode === "busy") {
  const owner = supervisor("blocked-child");
  const cancellation = new AbortController();
  const pending = owner.read(input, { signal: cancellation.signal });
  if (mode === "busy") failure(await owner.read(input), "docx_supervisor_busy");
  await waitFor("worker-heartbeat");
  cancellation.abort();
  failure(await pending, "docx_cancelled");
  await stopped();
  await noFurtherWrites("worker-heartbeat");
  failure(await owner.read(input, { signal: AbortSignal.abort() }), "docx_cancelled");
} else if (mode === "pre-cancel") {
  failure(await supervisor().read(input, { signal: AbortSignal.abort() }), "docx_cancelled");
  assert.equal(existsSync(join(workspace, "child-pid")), false);
} else if (mode === "input-limit") {
  failure(
    await supervisor().read(input, { limits: { compressedInputBytes: 1 } }),
    "docx_limit:compressedInputBytes",
  );
  assert.equal(existsSync(join(workspace, "child-pid")), false);
} else if (mode === "startup") {
  failure(
    await supervisor("tracked-child", { execPath: join(workspace, "missing-node") }).read(input),
    "docx_startup_error",
  );
} else if (mode === "worker-crash") {
  failure(await supervisor("crash-child").read(input), "docx_worker_error");
  await stopped();
} else if (mode === "unconfirmed-cleanup") {
  const owner = supervisor("protocol-stubborn-child");
  failure(
    await owner.read(input, {
      limits: { elapsedMilliseconds: 500, cleanupMilliseconds: 50, termGraceMilliseconds: 500 },
    }),
    "docx_cleanup_unconfirmed",
  );
  failure(await owner.read(input), "docx_supervisor_busy");
  await waitStopped();
  failure(await owner.read(input, { signal: AbortSignal.abort() }), "docx_cancelled");
  await noFurtherWrites("child-heartbeat");
} else if (mode === "offline-probe") {
  failure(await supervisor().read(input), "docx_offline_guard_failed");
  await stopped();
} else if (mode.startsWith("offline-")) {
  const result = await supervisor().read(input);
  assert(result.ok, JSON.stringify(result));
  const expected =
    mode === "offline-executable-embedded-parts"
      ? "Embedded Object Report"
      : "Offline Resource Report";
  assert(result.facts.rawText.includes(expected));
  assert(!result.facts.rawText.includes("never-load.png"));
  assert(!result.facts.rawText.includes("DOCX_BASELINE_EXECUTED"));
  await stopped();
} else if (mode.startsWith("rss-")) {
  const entry = mode === "rss-real" ? "rss-child" : `${mode}-child`;
  const result = await supervisor(entry).read(input, {
    limits: { peakRssBytes: mode === "rss-real" ? 128 * 1024 * 1024 : 5 },
  });
  if (mode === "rss-above" || mode === "rss-real") failure(result, "docx_limit:peakRssBytes");
  else assert(result.ok);
  await stopped();
} else if (mode === "parent-disconnect" || mode.startsWith("request-")) {
  const child = spawn(process.execPath, [join(workspace, "blocked-child.mjs")], {
    cwd: workspace,
    env: { NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "ignore"],
  });
  const output: Buffer[] = [];
  let outputBytes = 0;
  child.stdout.on("data", (chunk: Buffer) => {
    outputBytes += chunk.length;
    assert(outputBytes <= 4_096);
    output.push(chunk);
  });
  child.stdin.on("error", () => {});
  let closed = false;
  const completion = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", () => {
      closed = true;
      resolve();
    });
  });
  let forced = false;
  const timer = setTimeout(() => {
    forced = true;
    child.kill("SIGKILL");
  }, 4_000);
  try {
    const document = await readFile(input);
    const metadata = Buffer.from(
      JSON.stringify(
        resolveDocxLimits(
          mode === "request-document-limit" ? { compressedInputBytes: document.length - 1 } : {},
        ),
      ),
    );
    const header = Buffer.alloc(16);
    header.write("CDXDRQ01");
    header.writeUInt32BE(metadata.length, 8);
    header.writeUInt32BE(document.length, 12);
    let bytes = Buffer.concat([header, metadata, document]);
    if (mode === "request-magic") bytes[0] = 0;
    if (mode === "request-metadata-limit") bytes.writeUInt32BE(65_537, 8);
    if (mode === "request-trailing") bytes = Buffer.concat([bytes, Buffer.from([0])]);
    if (mode === "request-truncated") bytes = bytes.subarray(0, bytes.length - 1);
    child.stdin.write(bytes);
    if (mode === "parent-disconnect") {
      await waitFor("worker-heartbeat");
      child.stdin.end();
    } else if (mode === "request-truncated") child.stdin.end();
    await completion;
    assert(closed);
    assert.equal(forced, false);
    await stopped();
    if (mode === "parent-disconnect") await noFurtherWrites("worker-heartbeat");
    else if (mode === "request-truncated") assert.equal(outputBytes, 0);
    else {
      const resultBytes = Buffer.concat(output);
      assert.equal(resultBytes.subarray(0, 8).toString(), "CDXDRS01");
      assert.equal(resultBytes.readUInt32BE(8), resultBytes.length - 12);
      const diagnostic =
        mode === "request-document-limit"
          ? "docx_limit:compressedInputBytes"
          : "docx_protocol_error";
      failure(JSON.parse(resultBytes.subarray(12).toString()), diagnostic);
      assert.equal(existsSync(join(workspace, "worker-heartbeat")), false);
    }
  } finally {
    clearTimeout(timer);
    if (!closed) {
      child.kill("SIGKILL");
      await completion;
    }
  }
} else if (mode.startsWith("protocol-")) {
  const result = await supervisor(`${mode}-child`).read(input, {
    limits: { elapsedMilliseconds: mode === "protocol-stubborn" ? 500 : 3_000 },
  });
  if (mode === "protocol-valid") assert(result.ok);
  else if (
    mode === "protocol-early-exit" ||
    mode === "protocol-crash" ||
    mode === "protocol-success-crash"
  )
    failure(result, "docx_child_exit");
  else if (mode === "protocol-stubborn") failure(result, "docx_limit:elapsedMilliseconds");
  else if (mode === "protocol-oversized") failure(result, "docx_limit:resultBytes");
  else failure(result, "docx_protocol_error");
  await stopped();
  if (mode === "protocol-stubborn") await noFurtherWrites("child-heartbeat");
} else {
  throw new Error("Unknown runtime matrix mode");
}

process.stdout.write(JSON.stringify({ passed: true }));
