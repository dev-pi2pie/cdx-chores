import { expect, test } from "bun:test";
import { Writable } from "node:stream";

import { createHarness } from "../../../scripts/docx-candidate/harness/index.mjs";
import {
  requireTreeSettlementCapability,
  waitForProcessGroupSettlement,
} from "../../../scripts/docx-candidate/harness/command.mjs";
import { createOutputWriter } from "../../../scripts/docx-candidate/harness/output.mjs";
import {
  createProgressDecoder,
  createProgressEmitter,
} from "../../../scripts/docx-candidate/harness/protocol.mjs";

function destination(tty = false) {
  let text = "";
  const stream = Object.assign(
    new Writable({
      write(chunk, _encoding, callback) {
        text += chunk.toString();
        callback();
      },
    }),
    { isTTY: tty },
  );
  return { stream, text: () => text };
}

test("progress protocol handles fragmentation and ignores raw private log lines", async () => {
  const events: object[] = [];
  const decoder = createProgressDecoder((event: object) => {
    events.push(event);
  });
  const producer = destination();
  const emit = createProgressEmitter(producer.stream);
  await emit({ event: "scope", total: 1 });
  await emit({ event: "start", id: "synthetic-case" });
  await emit({ event: "complete", id: "synthetic-case", completed: 1 });
  const bytes = Buffer.from(
    "private dependency log\n" + "x".repeat(2_000) + "\n" + producer.text(),
  );
  for (let offset = 0; offset < bytes.length; offset += 7)
    await decoder.push(bytes.subarray(offset, offset + 7));
  decoder.finish();
  expect(events).toEqual([
    { event: "scope", total: 1 },
    { event: "start", id: "synthetic-case" },
    { event: "complete", id: "synthetic-case", completed: 1 },
  ]);
});

test("progress protocol rejects invalid payloads, inflated completion and unfinished work", async () => {
  for (const value of [
    { event: "scope", total: 0 },
    { event: "start", id: "private/path" },
    { event: "start", id: "okay", contents: "private" },
  ]) {
    const emit = createProgressEmitter(destination().stream);
    await expect(emit(value)).rejects.toMatchObject({ category: "output" });
  }
  for (const bad of [
    'DOCX_PROGRESS {"event":"start","id":"a"}\n',
    'DOCX_PROGRESS {"event":"scope","total":1}\nDOCX_PROGRESS {"event":"complete","id":"a","completed":1}\n',
    'DOCX_PROGRESS {"event":"scope","total":2}\nDOCX_PROGRESS {"event":"start","id":"a"}\nDOCX_PROGRESS {"event":"complete","id":"a","completed":2}\n',
    "DOCX_PROGRESS " + "x".repeat(600),
  ]) {
    const decoder = createProgressDecoder(() => {});
    await expect(decoder.push(Buffer.from(bad))).rejects.toMatchObject({ category: "output" });
  }
  const decoder = createProgressDecoder(() => {});
  await decoder.push(
    Buffer.from(
      'DOCX_PROGRESS {"event":"scope","total":1}\nDOCX_PROGRESS {"event":"start","id":"a"}\n',
    ),
  );
  expect(() => decoder.finish()).toThrow();
});

test("failure identity is retained without claiming completed work", async () => {
  const decoder = createProgressDecoder(() => {});
  await decoder.push(
    Buffer.from(
      'DOCX_PROGRESS {"event":"scope","total":2}\nDOCX_PROGRESS {"event":"start","id":"a"}\nDOCX_PROGRESS {"event":"failure","id":"a"}\nDOCX_PROGRESS {"event":"complete","id":"a","completed":1}\nDOCX_PROGRESS {"event":"start","id":"b"}\n',
    ),
  );
  expect(decoder.current).toBe("a");
});

test("existing camelCase resource case IDs remain valid progress identities", async () => {
  const events: object[] = [];
  const decoder = createProgressDecoder((event: object) => {
    events.push(event);
  });
  await decoder.push(
    Buffer.from(
      'DOCX_PROGRESS {"event":"scope","total":1}\nDOCX_PROGRESS {"event":"start","id":"resource-maxPartDecompressedBytes-at"}\nDOCX_PROGRESS {"event":"complete","id":"resource-maxPartDecompressedBytes-at","completed":1}\n',
    ),
  );
  decoder.finish();
  expect(events).toHaveLength(3);
});

test("styling uses stderr terminal and NO_COLOR presence independently of stdout", async () => {
  for (const [tty, env, colored] of [
    [true, {}, true],
    [true, { NO_COLOR: "" }, false],
    [false, { FORCE_COLOR: "1" }, false],
  ] as const) {
    const stderr = destination(tty);
    const stdout = destination(!tty);
    const h = createHarness({
      title: "Synthetic validation",
      scope: "one case",
      stderr: stderr.stream,
      stdout: stdout.stream,
      env,
      installSignals: false,
    });
    await h.start();
    await h.stage("Compare fixtures");
    await h.success("Completed");
    await h.result("stable result\n");
    await h.finish();
    expect(stderr.text().includes("\u001b[")).toBe(colored);
    expect(stderr.text()).toContain("Compare fixtures");
    expect(stdout.text()).toBe("stable result\n");
  }
});

test("quiet heartbeat reports waiting without inventing completed work", async () => {
  let now = 0;
  let tick = () => {};
  let cancelled = false;
  const stderr = destination();
  const h = createHarness({
    title: "Synthetic validation",
    scope: "one case",
    stderr: stderr.stream,
    stdout: destination().stream,
    installSignals: false,
    now: () => now,
    heartbeatMs: 1000,
    every: (_ms: number, callback: () => void) => {
      tick = callback;
      return () => {
        cancelled = true;
      };
    },
  });
  await h.start();
  await h.stage("Quiet comparison");
  now = 999;
  tick();
  expect(stderr.text()).not.toContain("waiting");
  now = 1000;
  tick();
  await h.finish();
  expect(stderr.text()).toContain("Quiet comparison · 1s waiting");
  expect(stderr.text()).not.toContain("checked");
  expect(cancelled).toBe(true);
});

test("output writer bounds delivery and pending bytes and handles destination failure", async () => {
  for (const mode of ["timeout", "limit", "error"]) {
    let failures = 0;
    const stream = new Writable({
      write(_chunk, _encoding, callback) {
        if (mode === "error") callback(new Error("private error"));
      },
    });
    const writer = createOutputWriter(stream, {
      timeoutMs: 10,
      maxPendingBytes: 4,
      onFailure: () => {
        failures += 1;
      },
    });
    const output = writer.write(mode === "limit" ? "12345" : "1234");
    await expect(output).rejects.toMatchObject({ category: "output" });
    expect(failures).toBe(1);
    await expect(writer.write("x")).rejects.toMatchObject({ category: "output" });
    writer.dispose();
  }
});

test("final stdout delivery failure cancels the harness and cannot finish successfully", async () => {
  const stdout = new Writable({ write() {} });
  const h = createHarness({
    title: "Synthetic validation",
    scope: "final result",
    stderr: destination().stream,
    stdout,
    installSignals: false,
    outputTimeoutMs: 10,
  });
  await h.start();
  await expect(h.result("stable result\n")).rejects.toMatchObject({ category: "output" });
  expect(h.signal.aborted).toBe(true);
  await expect(h.finish()).rejects.toMatchObject({ category: "output" });
});

test("unverified Windows descendant settlement fails conservatively without changing host state", () => {
  const platform = process.platform;
  let failure;
  try {
    requireTreeSettlementCapability("win32", 123, "Synthetic command", "synthetic-case");
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({
    category: "cleanup",
    stage: "Synthetic command",
    id: "synthetic-case",
    cleanupUnconfirmed: true,
  });
  expect(() =>
    requireTreeSettlementCapability("win32", undefined, "Startup", undefined),
  ).not.toThrow();
  expect(() =>
    requireTreeSettlementCapability("darwin", 123, "Synthetic command", "synthetic-case"),
  ).not.toThrow();
  expect(process.platform).toBe(platform);
});

test("a transient unknown group observation waits for explicit absence", async () => {
  let clock = 0;
  const probes: number[] = [];
  await waitForProcessGroupSettlement(123, "Synthetic command", "synthetic-case", {
    deadline: 50,
    now: () => clock,
    wait: async (milliseconds: number) => {
      clock += milliseconds;
    },
    probe: (group: number) => {
      probes.push(group);
      throw Object.assign(new Error("controlled observation"), {
        code: probes.length === 1 ? "EPERM" : "ESRCH",
      });
    },
  });
  expect(probes).toEqual([-123, -123]);
  expect(clock).toBe(25);
});

test("persistent unknown or failed group observation retains cleanup uncertainty", async () => {
  for (const code of ["EPERM", "EIO"]) {
    let clock = 0;
    await expect(
      waitForProcessGroupSettlement(123, "Synthetic command", "synthetic-case", {
        deadline: 50,
        now: () => clock,
        wait: async (milliseconds: number) => {
          clock += milliseconds;
        },
        probe: () => {
          throw Object.assign(new Error("controlled observation"), { code });
        },
      }),
    ).rejects.toMatchObject({
      category: "cleanup",
      id: "synthetic-case",
      cleanupUnconfirmed: true,
    });
    expect(clock).toBe(code === "EPERM" ? 50 : 0);
  }
});
