import { CliError } from "../../errors";

export interface ImageSink {
  begin(): Promise<void>;
  write(bytes: Buffer): Promise<void>;
  complete(): Promise<void>;
}
export const invalidImageStream = () =>
  new CliError("Invalid or incomplete encoded image stream.", { code: "FRAME_IMAGE_INCOMPLETE" });
export class Header {
  private storage = Buffer.alloc(0);
  private size = 0;
  get bytes() {
    return this.storage.subarray(0, this.size);
  }
  take(value: Buffer, offset: number, size: number): number {
    const used = Math.min(size - this.size, value.length - offset);
    if (this.storage.length < this.size + used) {
      const storage = Buffer.allocUnsafe(Math.max(this.size + used, this.storage.length * 2));
      this.bytes.copy(storage);
      this.storage = storage;
    }
    value.copy(this.storage, this.size, offset, offset + used);
    this.size += used;
    return used;
  }
  pop() {
    const bytes = this.bytes;
    this.storage = Buffer.alloc(0);
    this.size = 0;
    return bytes;
  }
}
export interface Framer {
  chunk(value: Buffer): Promise<void>;
  finish(): void;
}
