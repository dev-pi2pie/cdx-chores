import { CliError } from "../errors";
import type { ImageFormat } from "./image-options";
import {
  MAX_PROFILE_BYTES,
  jpegProfileSegments,
  pngCrc,
  pngProfileChunk,
  validateImageProfile,
  webpExtendedChunk,
  webpProfileChunk,
  type ImageProfile,
} from "./profile-chunks";
export type { ImageProfile } from "./profile-chunks";
export interface ImageSink {
  begin(): Promise<void>;
  write(bytes: Buffer): Promise<void>;
  complete(): Promise<void>;
}
const invalid = () =>
  new CliError("Invalid or incomplete encoded image stream.", { code: "FRAME_IMAGE_INCOMPLETE" });
class Header {
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
interface Framer {
  chunk(value: Buffer): Promise<void>;
  finish(): void;
}
export function imageFramer(format: ImageFormat, sink: ImageSink, profile?: ImageProfile): Framer {
  if (profile) validateImageProfile(profile);
  return format === "png"
    ? new PngFrames(sink, profile)
    : format === "jpg"
      ? new JpegFrames(sink, profile)
      : new WebpFrames(sink, profile);
}
class PngFrames implements Framer {
  private header = new Header();
  private state: "signature" | "header" | "data" = "signature";
  private remaining = 0;
  private type = "";
  private first = true;
  private data = false;
  private metadata = new Header();
  private seen = new Set<string>();
  private capture = false;
  private nonDataChunks = 0;
  private profileChunk?: Buffer;
  constructor(
    private sink: ImageSink,
    private profile?: ImageProfile,
  ) {
    if (profile) this.profileChunk = pngProfileChunk(profile.icc);
  }
  private async capturedChunk() {
    const bytes = this.metadata.pop();
    if (pngCrc(bytes.subarray(4, -4)) !== bytes.readUInt32BE(bytes.length - 4)) throw invalid();
    const body = bytes.subarray(8, -4);
    if (this.type === "IHDR") {
      if (
        body.readUInt32BE(0) !== this.profile!.width ||
        body.readUInt32BE(4) !== this.profile!.height ||
        body[8] !== 8 ||
        (body[9] !== 2 && body[9] !== 6) ||
        body[10] !== 0 ||
        body[11] !== 0 ||
        body[12]! > 1
      )
        throw invalid();
      await this.sink.write(bytes);
      await this.sink.write(this.profileChunk!);
    } else if (this.type === "iCCP") {
      const nul = body.indexOf(0);
      if (
        nul < 1 ||
        nul > 79 ||
        body[nul + 1] !== 0 ||
        body.length < nul + 4 ||
        (body[nul + 2]! & 15) !== 8 ||
        body[nul + 2]! >>> 4 > 7 ||
        !!(body[nul + 3]! & 32) ||
        ((body[nul + 2]! << 8) | body[nul + 3]!) % 31 !== 0
      )
        throw invalid();
    } else if (this.type === "sRGB" && body[0]! > 3) throw invalid();
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(value.length - offset, this.remaining);
        if (this.capture) this.metadata.take(value, offset, this.metadata.bytes.length + used);
        else await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        if (!this.remaining) {
          if (this.capture) await this.capturedChunk();
          if (this.type === "IEND") {
            if (!this.data) throw invalid();
            await this.sink.complete();
            this.state = "signature";
            this.first = true;
            this.data = false;
            this.seen.clear();
            this.nonDataChunks = 0;
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
        this.capture =
          !!this.profile && ["IHDR", "iCCP", "sRGB", "cICP", "gAMA", "cHRM"].includes(this.type);
        if (this.profile) {
          if (
            // IDAT streams through the sink's byte limit; encoded size determines its count.
            (this.type !== "IDAT" && ++this.nonDataChunks > 4096) ||
            length > 0x7fffffff ||
            ["acTL", "fcTL", "fdAT"].includes(this.type)
          )
            throw invalid();
          if (this.capture) {
            const fixed = { IHDR: 13, sRGB: 1, cICP: 4, gAMA: 4, cHRM: 32 }[this.type];
            if (
              this.data ||
              this.seen.has(this.type) ||
              (fixed !== undefined && length !== fixed) ||
              (this.type === "iCCP" && (length < 4 || length > MAX_PROFILE_BYTES))
            )
              throw invalid();
            this.seen.add(this.type);
          }
        }
        this.first = false;
        this.data ||= this.type === "IDAT";
        this.remaining = length + 4;
        if (this.capture) this.metadata.take(header, 0, 8);
        else await this.sink.write(header);
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
  private signature = Buffer.alloc(0);
  private chunkHeader = Buffer.alloc(0);
  private prefixSize = 0;
  private initialized = false;
  private extended = false;
  private alpha = false;
  private alphaChunk = false;
  private chunks = 0;
  private padded = false;
  private profileChunk?: Buffer;
  constructor(
    private sink: ImageSink,
    private profile?: ImageProfile,
  ) {
    if (profile) this.profileChunk = webpProfileChunk(profile.icc);
  }
  private dimensions(width: number, height: number) {
    if (width !== this.profile!.width || height !== this.profile!.height) throw invalid();
  }
  private async prefix(bytes: Buffer) {
    let alpha = false;
    if (this.type === "VP8X") {
      if (bytes[0]! & 0xc3 || bytes.subarray(1, 4).some((byte) => byte !== 0)) throw invalid();
      // Replacing an existing profile would require changing the declared RIFF size later.
      if (bytes[0]! & 32) throw invalid();
      this.dimensions(bytes.readUIntLE(4, 3) + 1, bytes.readUIntLE(7, 3) + 1);
      this.extended = true;
      this.alpha = !!(bytes[0]! & 16);
      bytes[0] = bytes[0]! | 32;
    } else if (this.type === "VP8L") {
      if (bytes[0] !== 0x2f || bytes[4]! & 0xe0) throw invalid();
      const bits = bytes.readUInt32LE(1);
      this.dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      alpha = !!(bits & 0x10000000);
      // VP8L's alpha bit is advisory. Existing VP8X flags remain authoritative.
      if (this.alphaChunk) throw invalid();
    } else {
      if (bytes[0]! & 1 || !bytes.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a])))
        throw invalid();
      this.dimensions(bytes.readUInt16LE(6) & 0x3fff, bytes.readUInt16LE(8) & 0x3fff);
      if (this.extended && this.alpha !== this.alphaChunk) throw invalid();
    }
    if (!this.initialized) {
      const overhead = this.profileChunk!.length + (this.extended ? 0 : 18);
      const size = this.signature.readUInt32LE(4) + overhead;
      if (size > 0xfffffff6) throw invalid();
      this.signature.writeUInt32LE(size, 4);
      await this.sink.write(this.signature);
      if (!this.extended) await this.sink.write(webpExtendedChunk(this.profile!, alpha));
      if (this.extended) {
        await this.sink.write(this.chunkHeader);
        await this.sink.write(bytes);
      }
      await this.sink.write(this.profileChunk!);
      this.initialized = true;
      if (this.extended) return;
    }
    await this.sink.write(this.chunkHeader);
    await this.sink.write(bytes);
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        let used: number;
        if (this.prefixSize) {
          used = this.header.take(value, offset, this.prefixSize);
          if (this.header.bytes.length === this.prefixSize) {
            await this.prefix(this.header.pop());
            this.prefixSize = 0;
          }
        } else {
          used = Math.min(value.length - offset, this.remaining);
          if (
            this.profile &&
            this.padded &&
            used === this.remaining &&
            value[offset + used - 1] !== 0
          )
            throw invalid();
          if (this.firstByte && this.type === "VP8X" && value[offset]! & 2) throw invalid();
          this.firstByte = false;
          await this.sink.write(value.subarray(offset, offset + used));
        }
        offset += used;
        this.remaining -= used;
        this.riff -= used;
        if (!this.remaining) {
          if (!this.riff) {
            if (!this.image) throw invalid();
            await this.sink.complete();
            this.state = "signature";
            this.image = false;
            this.initialized = false;
            this.extended = false;
            this.alpha = false;
            this.alphaChunk = false;
            this.chunks = 0;
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
          header.readUInt32LE(4) < 12 ||
          (this.profile &&
            (header.readUInt32LE(4) % 2 !== 0 || header.readUInt32LE(4) > 0xfffffff6))
        )
          throw invalid();
        this.riff = header.readUInt32LE(4) - 4;
        await this.sink.begin();
        if (this.profile) this.signature = header;
        else await this.sink.write(header);
        this.state = "header";
      } else {
        this.riff -= 8;
        this.type = header.toString("ascii", 0, 4);
        const length = header.readUInt32LE(4);
        this.padded = length % 2 !== 0;
        this.remaining = length + (length % 2);
        if (
          !this.remaining ||
          this.remaining > this.riff ||
          this.type === "ANIM" ||
          this.type === "ANMF" ||
          (this.type === "VP8X" && length !== 10)
        )
          throw invalid();
        if (this.profile) {
          if (
            ++this.chunks > 4096 ||
            this.type === "ICCP" ||
            (!this.initialized && !["VP8X", "VP8 ", "VP8L"].includes(this.type)) ||
            (this.type === "VP8X" && this.chunks !== 1) ||
            (this.type === "ALPH" &&
              (!this.extended || !this.alpha || this.alphaChunk || this.image))
          )
            throw invalid();
          if (this.type === "ALPH") this.alphaChunk = true;
          this.prefixSize =
            this.type === "VP8L" ? 5 : ["VP8X", "VP8 "].includes(this.type) ? 10 : 0;
          if (length < this.prefixSize) throw invalid();
          this.chunkHeader = header;
        }
        if (this.type === "VP8 " || this.type === "VP8L") {
          if (this.image) throw invalid();
          this.image = true;
        }
        this.firstByte = true;
        if (!this.prefixSize) await this.sink.write(header);
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
  private metadata = new Header();
  private pending: Buffer = Buffer.alloc(0);
  private inserted = false;
  private markers = 0;
  private profileSegments?: Buffer[];
  constructor(
    private sink: ImageSink,
    profile?: ImageProfile,
  ) {
    if (profile) this.profileSegments = jpegProfileSegments(profile.icc);
  }
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
      this.inserted = false;
      this.markers = 0;
      return;
    }
    if (marker === 216 || marker === 255 || marker < 192 || (marker >= 208 && marker <= 215))
      throw invalid();
    if (this.profileSegments && ++this.markers > 4096) throw invalid();
    if (marker === 218 && this.profileSegments && !this.inserted) {
      for (const segment of this.profileSegments) await this.sink.write(segment);
      this.inserted = true;
    }
    this.marker = marker;
    if (marker === 226 && this.profileSegments) this.pending = bytes;
    else await this.sink.write(bytes);
    this.state = "length";
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(this.remaining, value.length - offset);
        if (this.pending.length)
          this.metadata.take(value, offset, this.metadata.bytes.length + used);
        else await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        if (!this.remaining) {
          if (this.pending.length) {
            const metadata = this.metadata.pop();
            if (metadata.subarray(0, 11).equals(Buffer.from("ICC_PROFILE", "ascii")))
              throw invalid();
            await this.sink.write(this.pending);
            await this.sink.write(metadata);
            this.pending = Buffer.alloc(0);
          }
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
        if (this.pending.length) this.pending = Buffer.concat([this.pending, bytes]);
        else await this.sink.write(bytes);
        if (this.pending.length && !this.remaining) {
          await this.sink.write(this.pending);
          this.pending = Buffer.alloc(0);
        }
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
