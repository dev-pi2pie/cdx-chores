import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { open } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  createDocxSupervisorForTesting,
  type DocxInputHandle,
} from "../../../../src/docx/runtime/index";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function checkRejectedInputClose(workspace: string): Promise<void> {
  const input = join(workspace, "input.docx");
  const file = await open(input, "r");
  let closeCalls = 0;
  const owner = createDocxSupervisorForTesting({
    childPath: join(workspace, "tracked-child.mjs"),
    cwd: workspace,
    async openInput() {
      return {
        stat: () => file.stat(),
        read: (buffer, offset, length, position) => file.read(buffer, offset, length, position),
        async close() {
          closeCalls += 1;
          throw new Error("Synthetic close rejection");
        },
      };
    },
  });
  try {
    assert.deepEqual(await owner.read(input, { limits: { cleanupMilliseconds: 50 } }), {
      ok: false,
      diagnostic: "docx_cleanup_unconfirmed",
    });
    assert.equal(closeCalls, 1);
    assert.equal((await file.stat()).isFile(), true);
    assert.deepEqual(await owner.read(input), { ok: false, diagnostic: "docx_supervisor_busy" });
  } finally {
    // The rejecting wrapper cannot prove closure; the fixture owns this final real close.
    await file.close();
  }
}

/** Real descriptor ownership remains observable while a chosen operation is stalled. */
export async function checkInputStall(mode: string, workspace: string): Promise<void> {
  const operation = mode.split("-").at(-1)!;
  const cancellation = mode.startsWith("input-cancel-");
  const withinGrace = mode.startsWith("input-grace-");
  const input = join(workspace, "input.docx");
  const file = await open(input, "r");
  const gate = deferred();
  const entered = deferred();
  const closed = deferred();
  let closeCalls = 0;
  let childLaunches = 0;
  let graceTimer: NodeJS.Timeout | undefined;
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = new Proxy(originalSpawn, {
    apply(target, receiver, args) {
      childLaunches += 1;
      return Reflect.apply(target, receiver, args);
    },
  });
  syncBuiltinESMExports();
  async function stall(at: string) {
    if (operation !== at) return;
    entered.resolve();
    await gate.promise;
  }
  const handle: DocxInputHandle = {
    async stat() {
      await stall("stat");
      return file.stat();
    },
    async read(buffer, offset, length, position) {
      await stall("read");
      return file.read(buffer, offset, length, position);
    },
    async close() {
      closeCalls += 1;
      await stall("close");
      await file.close();
      closed.resolve();
    },
  };
  const owner = createDocxSupervisorForTesting({
    childPath: join(workspace, "tracked-child.mjs"),
    cwd: workspace,
    async openInput() {
      await stall("open");
      return handle;
    },
  });
  const abort = new AbortController();
  const started = performance.now();
  const pending = owner.read(input, {
    signal: abort.signal,
    limits: {
      elapsedMilliseconds: cancellation ? 1_000 : 50,
      cleanupMilliseconds: withinGrace ? 500 : 50,
    },
  });
  try {
    await entered.promise;
    if (cancellation) abort.abort();
    if (withinGrace) graceTimer = setTimeout(gate.resolve, 80);
    const result = await pending;
    assert(performance.now() - started < 1_500);
    assert.deepEqual(result, {
      ok: false,
      diagnostic: withinGrace ? "docx_limit:elapsedMilliseconds" : "docx_cleanup_unconfirmed",
    });
    assert.equal(childLaunches, 0);
    if (!withinGrace) {
      assert.deepEqual(await owner.read(input), { ok: false, diagnostic: "docx_supervisor_busy" });
      gate.resolve();
    }
    await closed.promise;
    let released = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const next = await owner.read(input, { signal: AbortSignal.abort() });
      if (!next.ok && next.diagnostic === "docx_cancelled") {
        released = true;
        break;
      }
      assert.deepEqual(next, { ok: false, diagnostic: "docx_supervisor_busy" });
      await delay(5);
    }
    assert(released);
    assert.equal(closeCalls, 1);
    await assert.rejects(file.stat(), { code: "EBADF" });
    await delay(20);
    assert.equal(childLaunches, 0);
  } finally {
    clearTimeout(graceTimer);
    gate.resolve();
    await pending;
    await file.close();
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
  }
}
