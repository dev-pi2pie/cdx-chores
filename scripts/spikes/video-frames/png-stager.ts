// Feasibility prototype only. Production publication belongs to Phase 4.
import { open, type FileHandle } from "node:fs/promises";
import { join } from "node:path";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const STAGING_BYTES = 256 * 1024 * 1024;

export class PngStager {
  readonly peaks = { files: 0, bytes: 0, recordBytes: 0 };
  private files = 0;
  private bytes = 0;
  private serial = 0;
  private file?: FileHandle;
  private path = "";
  private fileBytes = 0;
  private state: "signature" | "header" | "data" = "signature";
  private pending = Buffer.alloc(0);
  private remaining = 0;
  private type = "";
  private firstChunk = true;
  private tail: Promise<void> = Promise.resolve();
  private oldest: Promise<void> | undefined;
  private failure: unknown;

  constructor(
    private root: string,
    private publish: (path: string, serial: number) => Promise<void>,
    private options: { bytes?: number; signal?: AbortSignal } = {},
  ) {}

  private check() {
    this.options.signal?.throwIfAborted();
    if (this.failure) throw this.failure;
  }
  private async write(value: Buffer) {
    this.check();
    if (this.bytes + value.length > (this.options.bytes ?? STAGING_BYTES))
      throw new Error("Encoded staging exceeds its byte limit (including writes in progress).");
    this.bytes += value.length;
    this.fileBytes += value.length;
    this.peaks.bytes = Math.max(this.peaks.bytes, this.bytes);
    for (let offset = 0; offset < value.length;) {
      const { bytesWritten } = await this.file!.write(value, offset, value.length - offset);
      if (!bytesWritten) throw new Error("Staging write made no progress.");
      offset += bytesWritten;
    }
  }
  private async begin() {
    this.check();
    if (this.files === 2) await this.oldest;
    this.check();
    if (this.files >= 2) throw new Error("Staging slot ownership did not settle.");
    this.path = join(this.root, `stage-${++this.serial}.png`);
    this.file = await open(this.path, "wx");
    this.fileBytes = 0;
    this.files++;
    this.peaks.files = Math.max(this.peaks.files, this.files);
  }
  private async complete() {
    await this.file!.close();
    this.file = undefined;
    const path = this.path,
      bytes = this.fileBytes,
      serial = this.serial;
    const publication = this.tail.then(async () => {
      this.check();
      await this.publish(path, serial);
      this.files--;
      this.bytes -= bytes;
    });
    if (!this.oldest) this.oldest = publication;
    this.tail = publication;
    void publication.then(
      () => {
        if (this.oldest === publication)
          this.oldest = this.tail === publication ? undefined : this.tail;
      },
      (error) => {
        this.failure = error;
      },
    );
    this.state = "signature";
    this.firstChunk = true;
  }
  async chunk(value: Buffer): Promise<void> {
    this.peaks.recordBytes = Math.max(this.peaks.recordBytes, value.length);
    let offset = 0;
    while (offset < value.length) {
      this.check();
      if (this.state === "data") {
        const size = Math.min(value.length - offset, this.remaining);
        await this.write(value.subarray(offset, offset + size));
        offset += size;
        this.remaining -= size;
        if (!this.remaining) {
          if (this.type === "IEND") await this.complete();
          else this.state = "header";
        }
        continue;
      }
      const size = Math.min(8 - this.pending.length, value.length - offset);
      this.pending = Buffer.concat([this.pending, value.subarray(offset, offset + size)]);
      offset += size;
      if (this.pending.length !== 8) continue;
      const header = this.pending;
      this.pending = Buffer.alloc(0);
      if (this.state === "signature") {
        if (!header.equals(SIGNATURE)) throw new Error("Invalid PNG frame signature.");
        await this.begin();
        await this.write(header);
        this.state = "header";
      } else {
        const length = header.readUInt32BE(0);
        this.type = header.toString("ascii", 4, 8);
        if (this.firstChunk && (this.type !== "IHDR" || length !== 13))
          throw new Error("Invalid PNG first chunk.");
        if (this.type === "IEND" && length !== 0) throw new Error("Invalid PNG end chunk.");
        this.firstChunk = false;
        this.remaining = length + 4;
        await this.write(header);
        this.state = "data";
      }
    }
  }
  async finish() {
    if (this.file || this.pending.length || this.state !== "signature")
      throw new Error("Incomplete PNG image at EOF.");
    await this.tail;
    this.check();
  }
  async settle() {
    if (this.file) {
      await this.file.close();
      this.file = undefined;
    }
    await this.tail.catch(() => {});
  }
}
