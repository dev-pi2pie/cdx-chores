import { CliError } from "../errors";

export const RECORD_BYTES = 65_536;

/** Incremental UTF-8 line records; cumulative output is deliberately unlimited. */
export class LineRecords {
  private pending = Buffer.alloc(0);
  private stopped = false;
  private decoder = new TextDecoder("utf-8", { fatal: true });
  constructor(
    private consume: (line: string) => void | boolean | Promise<void | boolean>,
    private limit = RECORD_BYTES,
  ) {}

  async chunk(value: Buffer): Promise<boolean | void> {
    if (this.stopped) return false;
    let start = 0;
    for (;;) {
      const end = value.indexOf(10, start);
      const size = (end < 0 ? value.length : end) - start;
      if (this.pending.length + size > this.limit)
        throw new CliError(`Stream record exceeds ${this.limit} bytes.`, {
          code: "PROCESS_RECORD_LIMIT",
        });
      const part = value.subarray(start, end < 0 ? value.length : end);
      if (end < 0) {
        this.pending = Buffer.concat([this.pending, part]);
        return;
      }
      const bytes = Buffer.concat([this.pending, part]);
      this.pending = Buffer.alloc(0);
      const line = this.decoder.decode(bytes).replace(/\r$/, "");
      if ((await this.consume(line)) === false) {
        this.stopped = true;
        return false;
      }
      start = end + 1;
    }
  }
  finish() {
    if (!this.stopped && this.pending.length)
      throw new CliError("Incomplete stream record at EOF.", { code: "PROCESS_RECORD_INCOMPLETE" });
  }
}

export type ToolProgress = Readonly<Record<string, string>>;

export function progressRecords(
  consume: (progress: ToolProgress) => void | Promise<void>,
): Pick<LineRecords, "chunk" | "finish"> {
  let values: Record<string, string> = Object.create(null);
  let bytes = 0;
  const reader = new LineRecords(async (line) => {
    if (!line) return;
    const equal = line.indexOf("=");
    if (equal <= 0 || !/^[a-zA-Z0-9_]+$/.test(line.slice(0, equal)))
      throw new CliError("Invalid structured tool progress.", { code: "PROCESS_PROGRESS_INVALID" });
    const key = line.slice(0, equal);
    if (key in values)
      throw new CliError("Duplicate structured progress field.", {
        code: "PROCESS_PROGRESS_INVALID",
      });
    bytes += Buffer.byteLength(line);
    if (bytes > RECORD_BYTES)
      throw new CliError("Structured progress block exceeds 64 KiB.", {
        code: "PROCESS_RECORD_LIMIT",
      });
    values[key] = line.slice(equal + 1);
    if (key === "progress") {
      if (values.progress !== "continue" && values.progress !== "end")
        throw new CliError("Invalid structured progress state.", {
          code: "PROCESS_PROGRESS_INVALID",
        });
      await consume(Object.freeze(values));
      values = Object.create(null);
      bytes = 0;
    }
  });
  return {
    chunk: (value) => reader.chunk(value),
    finish() {
      reader.finish();
      if (bytes)
        throw new CliError("Incomplete structured progress block at EOF.", {
          code: "PROCESS_PROGRESS_INVALID",
        });
    },
  };
}
