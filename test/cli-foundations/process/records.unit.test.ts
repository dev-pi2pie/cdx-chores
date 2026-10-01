import { describe, expect, test } from "bun:test";
import { LineRecords, progressRecords } from "../../../src/cli/process/records";

describe("incremental tool records", () => {
  test("retains UTF-8 split across chunks and applies backpressure", async () => {
    const lines: string[] = [];
    let release!: () => void;
    const reader = new LineRecords(async (line) => {
      lines.push(line);
      if (lines.length === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    });
    const bytes = Buffer.from("第一\nsecond\r\n");
    await reader.chunk(bytes.subarray(0, 2));
    let done = false;
    const rest = reader.chunk(bytes.subarray(2)).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(lines).toEqual(["第一"]);
    expect(done).toBe(false);
    release();
    await rest;
    reader.finish();
    expect(lines).toEqual(["第一", "second"]);
  });
  test("accepts large cumulative streams without retaining a frame table", async () => {
    let lines = 0;
    const reader = new LineRecords(() => {
      lines++;
    });
    const chunk = Buffer.from(("a".repeat(100) + "\n").repeat(100));
    for (let i = 0; i < 110; i++) await reader.chunk(chunk);
    reader.finish();
    expect(lines).toBe(11000);
  });
  test("rejects individual record overflow, incomplete EOF, and invalid UTF-8", async () => {
    const reader = new LineRecords(() => {}, 8);
    await reader.chunk(Buffer.from("12345678"));
    await expect(reader.chunk(Buffer.from("9\n"))).rejects.toThrow("record exceeds");
    const partial = new LineRecords(() => {});
    await partial.chunk(Buffer.from("frame"));
    expect(() => partial.finish()).toThrow("Incomplete");
    await expect(new LineRecords(() => {}).chunk(Buffer.from([255, 10]))).rejects.toThrow();
  });
  test("a verified prefix stops before later records and needs no EOF", async () => {
    const lines: string[] = [];
    const reader = new LineRecords((line) => {
      lines.push(line);
      return false;
    });
    expect(await reader.chunk(Buffer.from("first\nsecond\npartial"))).toBe(false);
    reader.finish();
    expect(lines).toEqual(["first"]);
  });
  test("structured progress emits complete blocks and rejects incomplete/duplicate fields", async () => {
    const values: object[] = [];
    const reader = progressRecords((p) => {
      values.push(p);
    });
    await reader.chunk(
      Buffer.from("frame=2\nout_time_us=40000\nprogress=continue\nframe=3\nprogress=end\n"),
    );
    reader.finish();
    expect(values).toEqual([
      { frame: "2", out_time_us: "40000", progress: "continue" },
      { frame: "3", progress: "end" },
    ]);
    const incomplete = progressRecords(() => {});
    await incomplete.chunk(Buffer.from("frame=1\n"));
    expect(() => incomplete.finish()).toThrow("Incomplete structured");
    await expect(
      progressRecords(() => {}).chunk(Buffer.from("frame=1\nframe=2\n")),
    ).rejects.toThrow("Duplicate");
    await expect(
      progressRecords(() => {}).chunk(Buffer.from("progress=unknown\n")),
    ).rejects.toThrow("Invalid");
  });
});
