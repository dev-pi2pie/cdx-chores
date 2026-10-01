import { CliError } from "../errors";
import { DECODER_PIXELS } from "./metadata";

/** One reusable RGBA frame; its consumer must finish before the buffer is reused. */
export class RawFrames {
  private frame: Buffer;
  private offset = 0;
  count = 0;
  constructor(
    bytes: number,
    private consume: (frame: Buffer, index: number) => Promise<void>,
  ) {
    if (!Number.isSafeInteger(bytes) || bytes < 4 || bytes > DECODER_PIXELS * 4)
      throw new CliError("Invalid raw image capacity.", { code: "FRAME_PIXEL_LIMIT" });
    this.frame = Buffer.allocUnsafe(bytes);
  }
  async chunk(bytes: Buffer) {
    for (let position = 0; position < bytes.length;) {
      const length = Math.min(bytes.length - position, this.frame.length - this.offset);
      bytes.copy(this.frame, this.offset, position, position + length);
      this.offset += length;
      position += length;
      if (this.offset === this.frame.length) {
        await this.consume(this.frame, ++this.count);
        this.offset = 0;
      }
    }
  }
  finish(expected: number) {
    if (this.offset || this.count !== expected)
      throw new CliError("Selected raw images are incomplete or changed.", {
        code: "FRAME_IMAGE_INCOMPLETE",
      });
  }
}
