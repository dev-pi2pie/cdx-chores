import { CliError } from "../errors";
import type { ImageFormat } from "./image-options";
export interface ImageSink {
  begin(): Promise<void>;
  write(bytes: Buffer): Promise<void>;
  complete(): Promise<void>;
}
const invalid = () =>
  new CliError("Invalid or incomplete encoded image stream.", { code: "FRAME_IMAGE_INCOMPLETE" });
class Header {
  bytes = Buffer.alloc(0);
  take(value: Buffer, offset: number, size: number): number {
    const used = Math.min(size - this.bytes.length, value.length - offset);
    this.bytes = Buffer.concat([this.bytes, value.subarray(offset, offset + used)]);
    return used;
  }
  pop() {
    const bytes = this.bytes;
    this.bytes = Buffer.alloc(0);
    return bytes;
  }
}
interface Framer {
  chunk(value: Buffer): Promise<void>;
  finish(): void;
}
export function imageFramer(format: ImageFormat, sink: ImageSink): Framer {
  return format === "png"
    ? new PngFrames(sink)
    : format === "jpg"
      ? new JpegFrames(sink)
      : new WebpFrames(sink);
}
class PngFrames implements Framer {
  private header = new Header();
  private state: "signature" | "header" | "data" = "signature";
  private remaining = 0;
  private type = "";
  private first = true;
  private data = false;
  constructor(private sink: ImageSink) {}
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(value.length - offset, this.remaining);
        await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        if (!this.remaining) {
          if (this.type === "IEND") {
            if (!this.data) throw invalid();
            await this.sink.complete();
            this.state = "signature";
            this.first = true;
            this.data = false;
          } else this.state = "header";
        }
        continue;
      }
      offset += this.header.take(value, offset, 8);
      if (this.header.bytes.length !== 8) continue;
      const header = this.header.pop();
      if (this.state === "signature") {
        if (!header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw invalid();
        await this.sink.begin();
        await this.sink.write(header);
        this.state = "header";
      } else {
        const length = header.readUInt32BE(0);
        this.type = header.toString("ascii", 4, 8);
        if (
          !/^[a-zA-Z]{4}$/.test(this.type) ||
          (this.first && (this.type !== "IHDR" || length !== 13)) ||
          (!this.first && this.type === "IHDR") ||
          (this.type === "IEND" && length !== 0)
        )
          throw invalid();
        this.first = false;
        this.data ||= this.type === "IDAT";
        this.remaining = length + 4;
        await this.sink.write(header);
        this.state = "data";
      }
    }
  }
  finish() {
    if (this.state !== "signature" || this.header.bytes.length) throw invalid();
  }
}
class WebpFrames implements Framer {
  private header = new Header();
  private state: "signature" | "header" | "data" = "signature";
  private riff = 0;
  private remaining = 0;
  private type = "";
  private firstByte = false;
  private image = false;
  constructor(private sink: ImageSink) {}
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(value.length - offset, this.remaining);
        if (this.firstByte && this.type === "VP8X" && value[offset]! & 2) throw invalid();
        this.firstByte = false;
        await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        this.riff -= used;
        if (!this.remaining) {
          if (!this.riff) {
            if (!this.image) throw invalid();
            await this.sink.complete();
            this.state = "signature";
            this.image = false;
          } else this.state = "header";
        }
        continue;
      }
      const required = this.state === "signature" ? 12 : 8;
      offset += this.header.take(value, offset, required);
      if (this.header.bytes.length !== required) continue;
      const header = this.header.pop();
      if (this.state === "signature") {
        if (
          header.toString("ascii", 0, 4) !== "RIFF" ||
          header.toString("ascii", 8, 12) !== "WEBP" ||
          header.readUInt32LE(4) < 12
        )
          throw invalid();
        this.riff = header.readUInt32LE(4) - 4;
        await this.sink.begin();
        await this.sink.write(header);
        this.state = "header";
      } else {
        this.riff -= 8;
        this.type = header.toString("ascii", 0, 4);
        const length = header.readUInt32LE(4);
        this.remaining = length + (length % 2);
        if (
          !this.remaining ||
          this.remaining > this.riff ||
          this.type === "ANIM" ||
          this.type === "ANMF" ||
          (this.type === "VP8X" && length !== 10)
        )
          throw invalid();
        if (this.type === "VP8 " || this.type === "VP8L") {
          if (this.image) throw invalid();
          this.image = true;
        }
        this.firstByte = true;
        await this.sink.write(header);
        this.state = "data";
      }
    }
  }
  finish() {
    if (this.state !== "signature" || this.header.bytes.length) throw invalid();
  }
}
class JpegFrames implements Framer {
  private header = new Header();
  private state: "signature" | "marker" | "length" | "data" | "entropy" | "entropy-marker" =
    "signature";
  private marker = 0;
  private remaining = 0;
  private scanned = false;
  constructor(private sink: ImageSink) {}
  private async markerBytes(bytes: Buffer, entropy: boolean) {
    if (bytes[0] !== 255 || bytes[1] === 0) throw invalid();
    const marker = bytes[1]!;
    if (entropy && (marker === 0 || (marker >= 208 && marker <= 215))) {
      await this.sink.write(bytes);
      this.state = "entropy";
      return;
    }
    if (marker === 217) {
      if (!this.scanned) throw invalid();
      await this.sink.write(bytes);
      await this.sink.complete();
      this.state = "signature";
      this.scanned = false;
      return;
    }
    if (marker === 216 || marker === 255 || marker < 192 || (marker >= 208 && marker <= 215))
      throw invalid();
    this.marker = marker;
    await this.sink.write(bytes);
    this.state = "length";
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(this.remaining, value.length - offset);
        await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        if (!this.remaining) {
          if (this.marker === 218) {
            this.scanned = true;
            this.state = "entropy";
          } else this.state = "marker";
        }
        continue;
      }
      if (this.state === "entropy") {
        let cursor = offset;
        for (;;) {
          const found = value.indexOf(255, cursor);
          if (found < 0) {
            await this.sink.write(value.subarray(offset));
            offset = value.length;
            break;
          }
          if (found + 1 === value.length) {
            if (found > offset) await this.sink.write(value.subarray(offset, found));
            this.header.take(value, found, 2);
            offset = value.length;
            this.state = "entropy-marker";
            break;
          }
          const next = value[found + 1]!;
          if (next === 0 || (next >= 208 && next <= 215)) {
            cursor = found + 2;
            continue;
          }
          if (next === 255) {
            cursor = found + 1;
            continue;
          }
          if (found > offset) await this.sink.write(value.subarray(offset, found));
          await this.markerBytes(value.subarray(found, found + 2), true);
          offset = found + 2;
          break;
        }
        continue;
      }
      offset += this.header.take(value, offset, 2);
      if (this.header.bytes.length !== 2) continue;
      const bytes = this.header.pop();
      if (this.state === "signature") {
        if (bytes[0] !== 255 || bytes[1] !== 216) throw invalid();
        await this.sink.begin();
        await this.sink.write(bytes);
        this.state = "marker";
      } else if (this.state === "length") {
        const length = bytes.readUInt16BE(0);
        if (length < 2 || (this.marker === 218 && length < 3)) throw invalid();
        this.remaining = length - 2;
        await this.sink.write(bytes);
        this.state = this.remaining ? "data" : "marker";
      } else if (this.state === "entropy-marker" && bytes[1] === 255) {
        await this.sink.write(bytes.subarray(0, 1));
        this.header.take(bytes, 1, 2);
      } else if (
        this.state === "entropy-marker" &&
        (bytes[1] === 0 || (bytes[1]! >= 208 && bytes[1]! <= 215))
      ) {
        await this.sink.write(bytes);
        this.state = "entropy";
      } else await this.markerBytes(bytes, this.state === "entropy-marker");
    }
  }
  finish() {
    if (this.state !== "signature" || this.header.bytes.length) throw invalid();
  }
}
